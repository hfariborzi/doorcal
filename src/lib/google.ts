import { calendar as calendarApi, type calendar_v3 } from "@googleapis/calendar";
import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { db, users, type User } from "@/db";
import { decrypt } from "./crypto";
import { appUrl, GOOGLE_SCOPES } from "./config";

export class CalendarNotConnectedError extends Error {
  constructor() {
    super("Google Calendar is not connected");
  }
}

export function oauthClient(origin?: string) {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");
  return new OAuth2Client({
    clientId: id,
    clientSecret: secret,
    redirectUri: `${appUrl(origin)}/api/auth/google/callback`,
  });
}

export function authUrl(state: string, forceConsent: boolean, origin?: string) {
  return oauthClient(origin).generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
    prompt: forceConsent ? "consent" : "select_account",
  });
}

function calendarFor(user: User): calendar_v3.Calendar {
  if (!user.googleRefreshToken) throw new CalendarNotConnectedError();
  const client = oauthClient();
  client.setCredentials({ refresh_token: decrypt(user.googleRefreshToken) });
  return calendarApi({ version: "v3", auth: client });
}

// If Google says the grant is dead (user revoked access), forget the token so the UI asks to reconnect.
async function guard<T>(user: User, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = String((err as { message?: string })?.message ?? err);
    if (msg.includes("invalid_grant")) {
      await db.update(users).set({ googleRefreshToken: null }).where(eq(users.id, user.id));
      throw new CalendarNotConnectedError();
    }
    throw err;
  }
}

export type Interval = { start: number; end: number }; // epoch ms

export async function getBusy(user: User, timeMin: Date, timeMax: Date): Promise<Interval[]> {
  const cal = calendarFor(user);
  const ids = user.conflictCalendarIds.length ? user.conflictCalendarIds : ["primary"];
  const res = await guard(user, () =>
    cal.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: ids.map((id) => ({ id })),
      },
    }),
  );
  const out: Interval[] = [];
  for (const c of Object.values(res.data.calendars ?? {})) {
    for (const b of c.busy ?? []) {
      if (b.start && b.end) out.push({ start: Date.parse(b.start), end: Date.parse(b.end) });
    }
  }
  return out;
}

export type CalendarListItem = { id: string; summary: string; primary: boolean; color: string; canWrite: boolean };

export async function listCalendars(user: User): Promise<CalendarListItem[]> {
  const cal = calendarFor(user);
  const res = await guard(user, () => cal.calendarList.list({ maxResults: 250 }));
  return (res.data.items ?? [])
    .filter((c) => c.id)
    .map((c) => ({
      id: c.primary ? "primary" : c.id!,
      summary: c.summaryOverride || c.summary || c.id!,
      primary: !!c.primary,
      color: c.backgroundColor || "#2563eb",
      canWrite: c.accessRole === "owner" || c.accessRole === "writer",
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.summary.localeCompare(b.summary));
}

export type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  location?: string;
  meetLink?: string;
  htmlLink?: string;
  description?: string;
  attendees: { email: string; name?: string; status?: string }[];
  canEdit: boolean;
};

export async function listEvents(user: User, timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
  const cal = calendarFor(user);
  const calendars = await listCalendars(user);
  const wanted = new Set(user.conflictCalendarIds.length ? user.conflictCalendarIds : ["primary"]);
  wanted.add(user.writeCalendarId);
  const selected = calendars.filter((c) => wanted.has(c.id));

  const results = await Promise.all(
    selected.map(async (c) => {
      const res = await guard(user, () =>
        cal.events.list({
          calendarId: c.id,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 2500,
        }),
      );
      return (res.data.items ?? [])
        .filter((e) => e.status !== "cancelled")
        .map<CalendarEvent>((e) => ({
          id: e.id!,
          calendarId: c.id,
          title: e.summary || "(No title)",
          start: e.start?.dateTime || e.start?.date || "",
          end: e.end?.dateTime || e.end?.date || "",
          allDay: !e.start?.dateTime,
          color: c.color,
          location: e.location ?? undefined,
          meetLink: e.hangoutLink ?? undefined,
          htmlLink: e.htmlLink ?? undefined,
          description: e.description ?? undefined,
          attendees: (e.attendees ?? [])
            .filter((a) => a.email)
            .map((a) => ({ email: a.email!, name: a.displayName ?? undefined, status: a.responseStatus ?? undefined })),
          canEdit: c.canWrite,
        }));
    }),
  );
  return results.flat();
}

export type NewEvent = {
  calendarId: string;
  requestId: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendees: { email: string; displayName?: string }[];
  googleMeet: boolean;
  privateProps?: Record<string, string>;
};

export async function createEvent(user: User, ev: NewEvent) {
  const cal = calendarFor(user);
  const res = await guard(user, () =>
    cal.events.insert({
      calendarId: ev.calendarId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary: ev.summary,
        description: ev.description,
        location: ev.location,
        start: { dateTime: ev.start.toISOString(), timeZone: ev.timeZone },
        end: { dateTime: ev.end.toISOString(), timeZone: ev.timeZone },
        attendees: ev.attendees,
        guestsCanModify: false,
        extendedProperties: ev.privateProps ? { private: ev.privateProps } : undefined,
        conferenceData: ev.googleMeet
          ? { createRequest: { requestId: ev.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } }
          : undefined,
      },
    }),
  );
  return { id: res.data.id!, meetLink: res.data.hangoutLink ?? null, htmlLink: res.data.htmlLink ?? null };
}

export async function getEvent(user: User, calendarId: string, eventId: string) {
  const cal = calendarFor(user);
  const res = await guard(user, () => cal.events.get({ calendarId, eventId }));
  return res.data;
}

export async function patchEvent(
  user: User,
  calendarId: string,
  eventId: string,
  body: calendar_v3.Schema$Event,
  notify = true,
) {
  const cal = calendarFor(user);
  const res = await guard(user, () =>
    cal.events.patch({
      calendarId,
      eventId,
      sendUpdates: notify ? "all" : "none",
      conferenceDataVersion: 1,
      requestBody: body,
    }),
  );
  return res.data;
}

export async function deleteEvent(user: User, calendarId: string, eventId: string, notify = true) {
  const cal = calendarFor(user);
  try {
    await guard(user, () => cal.events.delete({ calendarId, eventId, sendUpdates: notify ? "all" : "none" }));
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 404 || code === 410) return; // already gone
    throw err;
  }
}
