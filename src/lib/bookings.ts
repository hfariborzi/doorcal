import { and, eq, gt, lt, ne } from "drizzle-orm";
import { DateTime } from "luxon";
import {
  db,
  bookings,
  eventTypes,
  users,
  type Booking,
  type BookingLocation,
  type CalendarAccount,
  type EventType,
  type User,
} from "@/db";
import { CalendarNotConnectedError, getAccount, listAccounts, providerFor, resolveWriteTarget } from "./calendar";
import { randomId } from "./crypto";
import { getSlots } from "./data";
import { bookingLocationText } from "./locations";
import { requestBaseUrl } from "./origin";

export class BookingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type BookingRequest = {
  start: string;
  duration: number;
  timezone: string;
  name: string;
  email: string;
  guests: string[];
  notes: string;
  answers: Record<string, string>;
  locationIndex: number;
  phone?: string;
};

async function assertSlotAvailable(user: User, et: EventType, start: Date, duration: number, ignoreUid?: string) {
  const { slots, schedule } = await getSlots({
    user,
    eventType: et,
    duration,
    rangeStart: new Date(start.getTime() - 60_000),
    rangeEnd: new Date(start.getTime() + 60_000),
    ignoreBookingUid: ignoreUid,
  });
  if (!slots.some((s) => Date.parse(s.start) === start.getTime())) {
    throw new BookingError("That time is no longer available. Please pick another slot.", 409);
  }
  return schedule;
}

const EXCLUSION_VIOLATION = "23P01";
const STALE_CLAIM_MS = 5 * 60_000;

function isOverlapError(err: unknown) {
  // Drivers and Drizzle may wrap the Postgres error; look a few levels down.
  let e = err as { code?: string; cause?: unknown } | undefined;
  for (let i = 0; e && i < 4; i++, e = e.cause as typeof e) {
    if (e.code === EXCLUSION_VIOLATION) return true;
  }
  return false;
}

/** The host's account that holds this booking's calendar event, or null if it was removed. */
async function bookingAccount(host: User, b: Pick<Booking, "accountId">): Promise<CalendarAccount | null> {
  return b.accountId ? getAccount(host.id, b.accountId) : null;
}

/** True when the booking's calendar event is still there. Null account means we can't tell: assume it is. */
async function eventStillExists(host: User, b: Pick<Booking, "accountId" | "calendarId" | "eventId">) {
  if (!b.eventId || !b.calendarId) return true;
  const account = await bookingAccount(host, b);
  if (!account) return true;
  const snapshot = await providerFor(account).getEvent(account, b.calendarId, b.eventId);
  return !!snapshot && !snapshot.cancelled;
}

async function markDeletedInCalendar(uid: string) {
  await db
    .update(bookings)
    .set({ status: "cancelled", cancelledBy: "host", cancelReason: "Deleted from the calendar" })
    .where(and(eq(bookings.uid, uid), eq(bookings.status, "confirmed")));
}

/**
 * Release one-on-one bookings overlapping [start, end) that no longer hold the time: their calendar event was
 * deleted outside the app, or the claim never finished (the request died before creating the event).
 */
async function releaseStaleOverlaps(host: User, start: Date, end: Date, exceptUid?: string) {
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, host.id),
        eq(bookings.status, "confirmed"),
        eq(bookings.exclusive, true),
        lt(bookings.start, end),
        gt(bookings.end, start),
        exceptUid ? ne(bookings.uid, exceptUid) : undefined,
      ),
    );
  let released = false;
  for (const b of rows) {
    if (!b.eventId || !b.calendarId) {
      if (Date.now() - b.createdAt.getTime() > STALE_CLAIM_MS) {
        await db.delete(bookings).where(eq(bookings.id, b.id));
        released = true;
      }
    } else if (!(await eventStillExists(host, b))) {
      await markDeletedInCalendar(b.uid);
      released = true;
    }
  }
  return released;
}

/** Run a write guarded by the no-overlap constraint. On conflict, release stale bookings and retry once. */
async function withOverlapRetry<T>(host: User, start: Date, end: Date, exceptUid: string | undefined, write: () => Promise<T>) {
  try {
    return await write();
  } catch (err) {
    if (!isOverlapError(err)) throw err;
  }
  if (await releaseStaleOverlaps(host, start, end, exceptUid)) {
    try {
      return await write();
    } catch (err) {
      if (!isOverlapError(err)) throw err;
    }
  }
  throw new BookingError("That time is no longer available. Please pick another slot.", 409);
}

/** Mark bookings whose calendar event was deleted outside the app as cancelled. Returns the cancelled uids. */
export async function syncDeletedBookings(host: User, rows: Booking[]) {
  const gone = new Set<string>();
  await Promise.all(
    rows.map(async (b) => {
      if (b.status !== "confirmed" || !b.eventId || !b.calendarId) return;
      try {
        if (!(await eventStillExists(host, b))) {
          await markDeletedInCalendar(b.uid);
          gone.add(b.uid);
        }
      } catch {
        // Provider unreachable or account disconnected: leave the booking as it is.
      }
    }),
  );
  return gone;
}

function describe(opts: {
  et: EventType;
  booking: Pick<Booking, "uid" | "name" | "email" | "notes" | "answers" | "location">;
  includeManageLinks: boolean;
  baseUrl: string;
}) {
  const { et, booking } = opts;
  const lines: string[] = [];
  if (et.description) lines.push(et.description, "");
  const loc = booking.location;
  if (loc.type !== "online") lines.push(`Where: ${bookingLocationText(loc)}`, "");
  if (opts.includeManageLinks) {
    lines.push(`Booked by: ${booking.name} <${booking.email}>`);
    for (const [label, a] of Object.entries(booking.answers)) lines.push(`${label}: ${a}`);
    if (booking.notes) lines.push("", "Notes:", booking.notes);
    const url = `${opts.baseUrl}/booking/${booking.uid}`;
    lines.push("", `Need to make a change? Reschedule or cancel: ${url}`);
  }
  return lines.join("\n").trim();
}

function resolveLocation(et: EventType, req: BookingRequest): BookingLocation {
  const opt = et.locations[req.locationIndex] ?? et.locations[0];
  if (!opt) return { type: "online" };
  switch (opt.type) {
    case "online":
      return { type: "online" };
    case "in_person":
      return { type: "in_person", value: opt.address };
    case "phone_host_calls":
      if (!req.phone?.trim()) throw new BookingError("Please enter your phone number.");
      return { type: "phone_host_calls", value: req.phone.trim() };
    case "phone_invitee_calls":
      return { type: "phone_invitee_calls", value: opt.phone };
    case "custom_link":
      return { type: "custom_link", value: opt.url };
  }
}

function eventSummary(et: EventType, host: User, inviteeName: string) {
  return et.seats > 1 ? et.title : `${et.title}: ${inviteeName} & ${host.name || host.username}`;
}

export async function createBooking(host: User, et: EventType, req: BookingRequest, rescheduledFrom?: string) {
  if (!et.durations.includes(req.duration)) throw new BookingError("Invalid duration.");
  for (const q of et.questions) {
    if (q.required && !req.answers[q.id]?.trim()) throw new BookingError(`"${q.label}" is required.`);
  }
  const start = new Date(req.start);
  if (Number.isNaN(start.getTime())) throw new BookingError("Invalid start time.");
  const end = new Date(start.getTime() + req.duration * 60_000);
  const schedule = await assertSlotAvailable(host, et, start, req.duration);

  const location = resolveLocation(et, req);
  const uid = randomId();
  // Store answers keyed by question label so they stay readable even if the event type changes later.
  const answers = Object.fromEntries(
    et.questions.filter((q) => req.answers[q.id]?.trim()).map((q) => [q.label, req.answers[q.id].trim()]),
  );
  const draft = { uid, name: req.name, email: req.email, notes: req.notes, answers, location };
  const attendees: { email: string; displayName?: string }[] = [
    { email: req.email, displayName: req.name },
    ...req.guests.map((g) => ({ email: g })),
  ];

  // Group events: join the existing session if one is already booked at this time.
  const [existing] =
    et.seats > 1
      ? await db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.eventTypeId, et.id),
              eq(bookings.start, start),
              eq(bookings.status, "confirmed"),
            ),
          )
          .limit(1)
      : [];
  const joining = !!(existing?.eventId && existing.calendarId && existing.accountId);
  const baseUrl = await requestBaseUrl();

  // Which connected account and calendar the event goes to. Resolved before the claim so a disconnected
  // calendar answers 503 without leaving a half-made booking behind.
  const accounts = await listAccounts(host.id);
  let target: { account: CalendarAccount; calendarId: string };
  if (joining) {
    const account = accounts.find((a) => a.id === existing.accountId);
    if (!account || !account.refreshToken) throw new CalendarNotConnectedError(account);
    target = { account, calendarId: existing.calendarId! };
  } else {
    target = resolveWriteTarget(host, accounts, et);
  }

  // Claim the slot in the database before touching the calendar. The bookings_no_overlap constraint refuses
  // overlapping one-on-one bookings, so two people booking the same time at once can't both get it.
  const [claim] = await withOverlapRetry(host, start, end, undefined, () =>
    db
      .insert(bookings)
      .values({
        uid,
        userId: host.id,
        eventTypeId: et.id,
        title: et.title,
        start,
        end,
        timezone: req.timezone,
        name: req.name,
        email: req.email,
        guests: req.guests,
        notes: req.notes,
        answers,
        location,
        meetLink: joining ? existing.meetLink : null,
        accountId: target.account.id,
        calendarId: target.calendarId,
        eventId: joining ? existing.eventId : null,
        rescheduledFrom: rescheduledFrom ?? null,
        exclusive: et.seats <= 1,
      })
      .returning(),
  );

  const provider = providerFor(target.account);
  let createdEventId: string | undefined;
  try {
    if (joining) {
      const ev = await provider.getEvent(target.account, target.calendarId, existing.eventId!);
      if (!ev || ev.cancelled) throw new BookingError("That session was cancelled. Please pick another time.", 409);
      const known = new Set(ev.attendees.map((a) => a.email.toLowerCase()));
      await provider.setAttendees(target.account, target.calendarId, existing.eventId!, [
        ...ev.attendees,
        ...attendees.filter((a) => !known.has(a.email.toLowerCase())).map((a) => ({ email: a.email, name: a.displayName })),
      ]);
      return claim;
    }
    const created = await provider.createEvent(target.account, target.calendarId, {
      requestId: uid,
      summary: eventSummary(et, host, req.name),
      description: describe({ et, booking: draft, includeManageLinks: et.seats <= 1, baseUrl }),
      location:
        location.type === "online"
          ? undefined
          : location.type === "in_person" || location.type === "custom_link"
            ? location.value
            : bookingLocationText(location),
      start,
      end,
      timeZone: schedule.timezone,
      attendees,
      onlineMeeting: location.type === "online",
      privateProps: { bookingUid: uid, eventTypeId: String(et.id) },
    });
    createdEventId = created.id;
    const [row] = await db
      .update(bookings)
      .set({ eventId: created.id, meetLink: created.meetLink })
      .where(eq(bookings.id, claim.id))
      .returning();
    return row;
  } catch (err) {
    // Release the claim, and the calendar event if it was already created, so nothing is left half-booked.
    await db.delete(bookings).where(eq(bookings.id, claim.id)).catch(() => {});
    if (createdEventId) await provider.deleteEvent(target.account, target.calendarId, createdEventId).catch(() => {});
    throw err;
  }
}

export async function getBookingByUid(uid: string) {
  const [row] = await db
    .select({ booking: bookings, host: users, eventType: eventTypes })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .leftJoin(eventTypes, eq(eventTypes.id, bookings.eventTypeId))
    .where(eq(bookings.uid, uid))
    .limit(1);
  return row ?? null;
}

/** Remove a booking from the host's calendar. Group sessions only drop this invitee. */
async function releaseCalendar(host: User, booking: Booking) {
  if (!booking.eventId || !booking.calendarId) return;
  const account = await bookingAccount(host, booking);
  if (!account) return; // the account was removed from DoorCal; the event stays under the host's control
  const provider = providerFor(account);
  const others = await db
    .select({ uid: bookings.uid })
    .from(bookings)
    .where(
      and(
        eq(bookings.accountId, account.id),
        eq(bookings.eventId, booking.eventId),
        eq(bookings.status, "confirmed"),
        ne(bookings.uid, booking.uid),
      ),
    );
  if (others.length === 0) {
    await provider.deleteEvent(account, booking.calendarId, booking.eventId);
    return;
  }
  const ev = await provider.getEvent(account, booking.calendarId, booking.eventId);
  if (!ev) return;
  const drop = new Set([booking.email, ...booking.guests].map((e) => e.toLowerCase()));
  await provider.setAttendees(account, booking.calendarId, booking.eventId, ev.attendees.filter((a) => !drop.has(a.email.toLowerCase())));
}

export async function cancelBooking(uid: string, by: "host" | "invitee", reason: string) {
  const row = await getBookingByUid(uid);
  if (!row) throw new BookingError("Booking not found.", 404);
  const { booking, host } = row;
  if (booking.status === "cancelled") return booking;
  await releaseCalendar(host, booking);
  const [updated] = await db
    .update(bookings)
    .set({ status: "cancelled", cancelledBy: by, cancelReason: reason || null })
    .where(eq(bookings.uid, uid))
    .returning();
  return updated;
}

export async function rescheduleBooking(uid: string, newStart: string, timezone: string) {
  const row = await getBookingByUid(uid);
  if (!row) throw new BookingError("Booking not found.", 404);
  const { booking, host, eventType: et } = row;
  if (!et) throw new BookingError("This event type no longer exists.", 410);
  if (booking.status !== "confirmed") throw new BookingError("This booking was cancelled.", 410);
  const duration = Math.round((booking.end.getTime() - booking.start.getTime()) / 60_000);

  if (et.seats > 1) {
    // Group: leave the old session and join (or start) the new one.
    const locationIndex = Math.max(
      0,
      et.locations.findIndex((l) => l.type === booking.location.type),
    );
    const fresh = await createBooking(
      host,
      et,
      {
        start: newStart,
        duration: et.durations.includes(duration) ? duration : et.durations[0],
        timezone,
        name: booking.name,
        email: booking.email,
        guests: booking.guests,
        notes: booking.notes,
        answers: Object.fromEntries(et.questions.map((q) => [q.id, booking.answers[q.label] ?? ""])),
        locationIndex,
        phone: booking.location.type === "phone_host_calls" ? booking.location.value : undefined,
      },
      booking.uid,
    );
    await cancelBooking(booking.uid, "invitee", "Rescheduled");
    return fresh;
  }

  const start = new Date(newStart);
  if (Number.isNaN(start.getTime())) throw new BookingError("Invalid start time.");
  const end = new Date(start.getTime() + duration * 60_000);
  const schedule = await assertSlotAvailable(host, et, start, duration, booking.uid);

  // Move the row first so the no-overlap constraint guards the new time, then move the calendar event.
  const account = await bookingAccount(host, booking);
  if (booking.eventId && booking.calendarId && account && !account.refreshToken) throw new CalendarNotConnectedError(account);
  const [updated] = await withOverlapRetry(host, start, end, booking.uid, () =>
    db.update(bookings).set({ start, end, timezone }).where(eq(bookings.uid, uid)).returning(),
  );
  if (booking.eventId && booking.calendarId && account) {
    try {
      await providerFor(account).moveEvent(account, booking.calendarId, booking.eventId, start, end, schedule.timezone);
    } catch (err) {
      await db
        .update(bookings)
        .set({ start: booking.start, end: booking.end, timezone: booking.timezone })
        .where(eq(bookings.uid, uid))
        .catch(() => {});
      throw err;
    }
  }
  return updated;
}

export function formatRange(start: Date, end: Date, tz: string) {
  const s = DateTime.fromJSDate(start).setZone(tz);
  const e = DateTime.fromJSDate(end).setZone(tz);
  return `${s.toFormat("h:mm a")} – ${e.toFormat("h:mm a")}, ${s.toFormat("cccc, LLLL d, yyyy")}`;
}

