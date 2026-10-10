/**
 * Keeps push-notification channels open on every connected account's conflict calendars, so a new booking or
 * an accepted invitation marks the user's plan stale right away instead of at the next periodic check.
 * Needs a public https APP_URL; local development falls back to the periodic check.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, calendarAccounts, calendarWatches, users, type CalendarAccount } from "@/db";
import { appUrl } from "../config";
import { randomId } from "../crypto";
import { logWarn } from "../log";
import { isConnected, listAccounts, providerFor } from "./index";

const RENEW_BEFORE_MS = 24 * 3_600_000;

/** Signs a channel id so a notification can be checked without storing a secret per channel. */
export function watchToken(channelId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`calendar-watch:${channelId}`).digest("base64url").slice(0, 40);
}

export function validWatchToken(channelId: string, token: string | null): boolean {
  if (!token) return false;
  const a = Buffer.from(watchToken(channelId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

function webhookAddress(provider: CalendarAccount["provider"]): string | null {
  const base = appUrl();
  try {
    const u = new URL(base);
    if (u.protocol !== "https:" || u.hostname === "localhost" || u.hostname.endsWith(".local")) return null;
  } catch {
    return null;
  }
  return `${base}/api/calendar/webhook/${provider}`;
}

/** Make sure each conflict calendar has a live channel; replace ones about to expire; stop ones no longer needed. */
export async function ensureWatches(userId: number): Promise<void> {
  for (const account of await listAccounts(userId)) {
    const address = webhookAddress(account.provider);
    if (!address || !isConnected(account)) continue;
    const provider = providerFor(account);
    const existing = await db.select().from(calendarWatches).where(eq(calendarWatches.accountId, account.id));
    const wanted = new Set(account.conflictCalendarIds);
    for (const w of existing) {
      const stale = !wanted.has(w.calendarId) || w.expiresAt.getTime() < Date.now() + RENEW_BEFORE_MS;
      if (!stale) continue;
      await provider.unwatch(account, w.channelId, w.resourceId).catch(() => {});
      await db.delete(calendarWatches).where(eq(calendarWatches.id, w.id));
    }
    const live = new Set(existing.filter((w) => wanted.has(w.calendarId) && w.expiresAt.getTime() >= Date.now() + RENEW_BEFORE_MS).map((w) => w.calendarId));
    for (const calendarId of wanted) {
      if (live.has(calendarId)) continue;
      const channelId = `dc-${randomId(16)}`;
      try {
        // Microsoft chooses its own subscription id, so the token signs the id we send and is checked against
        // the stored token's id; for Google they are the same.
        const token = watchToken(channelId);
        const w = await provider.watch(account, calendarId, address, channelId, token);
        await db.insert(calendarWatches).values({ accountId: account.id, calendarId, channelId: w.channelId, resourceId: w.resourceId ?? channelId, expiresAt: w.expiresAt });
      } catch (err) {
        logWarn("watch", `could not watch calendar for account ${account.id}: ${(err as Error).message}`);
      }
    }
  }
}

/**
 * A provider says something changed on a watched calendar. Google sends our channel id and token; Microsoft
 * sends its subscription id and the clientState (our token, signed over the id we generated, kept in
 * resourceId). Marks the owner's plan stale. Returns false for unknown or forged notifications.
 */
export async function noteCalendarChange(channelId: string, token: string | null): Promise<boolean> {
  const [w] = await db.select().from(calendarWatches).where(eq(calendarWatches.channelId, channelId)).limit(1);
  if (!w) return false;
  const signedOver = w.resourceId?.startsWith("dc-") ? w.resourceId : channelId;
  if (!validWatchToken(signedOver, token)) return false;
  const [account] = await db.select({ userId: calendarAccounts.userId }).from(calendarAccounts).where(eq(calendarAccounts.id, w.accountId)).limit(1);
  if (!account) return false;
  await db.update(users).set({ planDirtyAt: new Date() }).where(eq(users.id, account.userId));
  return true;
}

/** Drop records of channels that have already expired (the provider has stopped sending). */
export async function pruneExpiredWatches(): Promise<void> {
  await db.delete(calendarWatches).where(lt(calendarWatches.expiresAt, new Date()));
}

export async function usersWithAccounts(limit = 500): Promise<number[]> {
  const rows = await db.selectDistinct({ userId: calendarAccounts.userId }).from(calendarAccounts).limit(limit);
  return rows.map((r) => r.userId);
}

