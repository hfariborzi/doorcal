/**
 * Calendar access across all of a user's connected accounts. Routes and actions use these helpers rather
 * than talking to a provider directly, so account lookup and ownership checks happen in one place.
 */
import { and, asc, eq } from "drizzle-orm";
import { db, calendarAccounts, type CalendarAccount, type EventType, type Provider, type User } from "@/db";
import { logError } from "../log";
import { googleAuth, googleCalendar } from "./google";
import { microsoftAuth, microsoftCalendar } from "./microsoft";
import {
  CalendarNotConnectedError,
  type AuthProvider,
  type CalendarEvent,
  type CalendarListItem,
  type CalendarProvider,
  type Interval,
} from "./types";

export * from "./types";

const calendarProviders: Record<Provider, CalendarProvider> = { google: googleCalendar, microsoft: microsoftCalendar };
const authProviders: Record<Provider, AuthProvider> = { google: googleAuth, microsoft: microsoftAuth };

export const PROVIDERS: Provider[] = ["google", "microsoft"];

export function isProvider(p: string): p is Provider {
  return (PROVIDERS as string[]).includes(p);
}

export function providerFor(account: Pick<CalendarAccount, "provider">): CalendarProvider {
  return calendarProviders[account.provider];
}

export function authFor(provider: Provider): AuthProvider {
  return authProviders[provider];
}

export function enabledProviders(): Provider[] {
  return PROVIDERS.filter((p) => authProviders[p].enabled());
}

export const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", microsoft: "Microsoft" };

export const MEETING_LINK_LABEL: Record<Provider, string> = { google: "Google Meet", microsoft: "Microsoft Teams" };

export async function listAccounts(userId: number): Promise<CalendarAccount[]> {
  return db.select().from(calendarAccounts).where(eq(calendarAccounts.userId, userId)).orderBy(asc(calendarAccounts.id));
}

/** An account only if it belongs to the user; null otherwise. */
export async function getAccount(userId: number, accountId: number): Promise<CalendarAccount | null> {
  const [a] = await db
    .select()
    .from(calendarAccounts)
    .where(and(eq(calendarAccounts.id, accountId), eq(calendarAccounts.userId, userId)))
    .limit(1);
  return a ?? null;
}

export const isConnected = (a: CalendarAccount) => !!a.refreshToken;

export type WriteTarget = { account: CalendarAccount; calendarId: string };

/**
 * Where a booking of this event type goes: the type's own calendar if set, otherwise the user's default.
 * Throws CalendarNotConnectedError when that account is missing or needs reconnecting, so the booking
 * endpoints answer 503 instead of creating a booking with no calendar event.
 */
export function resolveWriteTarget(user: User, accounts: CalendarAccount[], et?: Pick<EventType, "writeAccountId" | "writeCalendarId"> | null): WriteTarget {
  const pick = (accountId: number | null, calendarId: string | null) => {
    const account = accounts.find((a) => a.id === accountId);
    return account ? { account, calendarId: calendarId || "primary" } : null;
  };
  const target = pick(et?.writeAccountId ?? null, et?.writeCalendarId ?? null) ?? pick(user.writeAccountId, user.writeCalendarId);
  if (!target) {
    // Nothing chosen (or the chosen account was removed): fall back to the first connected account.
    const first = accounts.find(isConnected);
    if (!first) throw new CalendarNotConnectedError();
    return { account: first, calendarId: "primary" };
  }
  if (!isConnected(target.account)) throw new CalendarNotConnectedError(target.account);
  return target;
}

/**
 * Busy intervals across every account's conflict calendars. Fails closed: an account that is used for
 * conflicts but has lost access makes the whole lookup fail, so nobody gets double-booked while the host
 * hasn't noticed the "reconnect" banner yet.
 */
export async function busyForAccounts(accounts: CalendarAccount[], timeMin: Date, timeMax: Date, tz: string): Promise<Interval[]> {
  const used = accounts.filter((a) => a.conflictCalendarIds.length > 0);
  const results = await Promise.all(
    used.map((a) => {
      if (!isConnected(a)) throw new CalendarNotConnectedError(a);
      return providerFor(a).getBusy(a, a.conflictCalendarIds, timeMin, timeMax, tz);
    }),
  );
  return results.flat();
}

export type AccountCalendars = { account: CalendarAccount; calendars: CalendarListItem[]; error: string | null };

/** Calendars of every connected account, with per-account errors instead of one failure for all. */
export async function calendarsForAccounts(accounts: CalendarAccount[]): Promise<AccountCalendars[]> {
  return Promise.all(
    accounts.map(async (account) => {
      if (!isConnected(account)) return { account, calendars: [], error: "Needs to be reconnected" };
      try {
        return { account, calendars: await providerFor(account).listCalendars(account), error: null };
      } catch (err) {
        logError(`calendar list ${account.provider}#${account.id}`, err);
        return {
          account,
          calendars: [],
          error: err instanceof CalendarNotConnectedError ? "Needs to be reconnected" : "Could not load calendars right now",
        };
      }
    }),
  );
}

export type EventsResult = { events: CalendarEvent[]; problems: { accountId: number; email: string; message: string }[] };

/** Calendars shown for an account in the dashboard: the user's choice, else conflicts + the booking calendar. */
export function visibleCalendarIds(user: Pick<User, "calendarPrefs" | "writeAccountId" | "writeCalendarId">, account: CalendarAccount): Set<string> {
  const chosen = user.calendarPrefs?.calendars?.[String(account.id)];
  if (chosen) return new Set(chosen);
  const wanted = new Set(account.conflictCalendarIds);
  if (user.writeAccountId === account.id) wanted.add(user.writeCalendarId);
  return wanted;
}

/** Dashboard events from each account's visible calendars (see visibleCalendarIds). */
export async function eventsForAccounts(user: User, accounts: CalendarAccount[], timeMin: Date, timeMax: Date): Promise<EventsResult> {
  const out: EventsResult = { events: [], problems: [] };
  await Promise.all(
    accounts.map(async (account) => {
      if (!isConnected(account)) {
        out.problems.push({ accountId: account.id, email: account.email, message: "needs to be reconnected" });
        return;
      }
      try {
        const provider = providerFor(account);
        const wanted = visibleCalendarIds(user, account);
        const calendars = (await provider.listCalendars(account)).filter((c) => wanted.has(c.id) && c.canReadEvents);
        out.events.push(...(await provider.listEvents(account, calendars, timeMin, timeMax)));
      } catch (err) {
        logError(`events ${account.provider}#${account.id}`, err);
        out.problems.push({
          accountId: account.id,
          email: account.email,
          message: err instanceof CalendarNotConnectedError ? "needs to be reconnected" : "could not be loaded right now",
        });
      }
    }),
  );
  return out;
}

export type WriteTargetOption = { value: string; accountId: number; calendarId: string; label: string; onlineMeetings: boolean };

/** Writable calendars as "<accountId>:<calendarId>" options, labelled "email › calendar". */
export function writeTargets(groups: AccountCalendars[]): WriteTargetOption[] {
  return groups.flatMap(({ account, calendars }) =>
    calendars
      .filter((c) => c.canWrite)
      .map((c) => ({
        value: `${account.id}:${c.id}`,
        accountId: account.id,
        calendarId: c.id,
        label: `${account.email} › ${c.summary}`,
        onlineMeetings: account.onlineMeetings,
      })),
  );
}
