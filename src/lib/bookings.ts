import { and, eq, ne } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, bookings, eventTypes, users, type Booking, type BookingLocation, type EventType, type User } from "@/db";
import { appUrl } from "./config";
import { randomId } from "./crypto";
import { getSlots } from "./data";
import { createEvent, deleteEvent, getEvent, patchEvent } from "./google";
import { bookingLocationText } from "./locations";

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

function describe(opts: {
  et: EventType;
  booking: Pick<Booking, "uid" | "name" | "email" | "notes" | "answers" | "location">;
  includeManageLinks: boolean;
}) {
  const { et, booking } = opts;
  const lines: string[] = [];
  if (et.description) lines.push(et.description, "");
  const loc = booking.location;
  if (loc.type !== "google_meet") lines.push(`Where: ${bookingLocationText(loc)}`, "");
  if (opts.includeManageLinks) {
    lines.push(`Booked by: ${booking.name} <${booking.email}>`);
    for (const [label, a] of Object.entries(booking.answers)) lines.push(`${label}: ${a}`);
    if (booking.notes) lines.push("", "Notes:", booking.notes);
    const url = `${appUrl()}/booking/${booking.uid}`;
    lines.push("", `Need to make a change? Reschedule or cancel: ${url}`);
  }
  return lines.join("\n").trim();
}

function resolveLocation(et: EventType, req: BookingRequest): BookingLocation {
  const opt = et.locations[req.locationIndex] ?? et.locations[0];
  if (!opt) return { type: "google_meet" };
  switch (opt.type) {
    case "google_meet":
      return { type: "google_meet" };
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
  const attendees = [
    { email: req.email, displayName: req.name },
    ...req.guests.map((g) => ({ email: g })),
  ];

  let googleEventId: string;
  let meetLink: string | null = null;

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

  if (existing?.googleEventId && existing.calendarId) {
    const ev = await getEvent(host, existing.calendarId, existing.googleEventId);
    const current = ev.attendees ?? [];
    const known = new Set(current.map((a) => a.email?.toLowerCase()));
    await patchEvent(host, existing.calendarId, existing.googleEventId, {
      attendees: [...current, ...attendees.filter((a) => !known.has(a.email.toLowerCase()))],
    });
    googleEventId = existing.googleEventId;
    meetLink = existing.meetLink;
  } else {
    const created = await createEvent(host, {
      calendarId: host.writeCalendarId,
      requestId: uid,
      summary: eventSummary(et, host, req.name),
      description: describe({ et, booking: draft, includeManageLinks: et.seats <= 1 }),
      location:
        location.type === "google_meet"
          ? undefined
          : location.type === "in_person" || location.type === "custom_link"
            ? location.value
            : bookingLocationText(location),
      start,
      end,
      timeZone: schedule.timezone,
      attendees,
      googleMeet: location.type === "google_meet",
      privateProps: { bookingUid: uid, eventTypeId: String(et.id) },
    });
    googleEventId = created.id;
    meetLink = created.meetLink;
  }

  try {
    const [row] = await db
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
        meetLink,
        calendarId: existing?.calendarId ?? host.writeCalendarId,
        googleEventId,
        rescheduledFrom: rescheduledFrom ?? null,
      })
      .returning();
    return row;
  } catch (err) {
    if (!existing) await deleteEvent(host, host.writeCalendarId, googleEventId).catch(() => {});
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

/** Remove a booking from Google Calendar. Group sessions only drop this invitee. */
async function releaseCalendar(host: User, booking: Booking) {
  if (!booking.googleEventId || !booking.calendarId) return;
  const others = await db
    .select({ uid: bookings.uid })
    .from(bookings)
    .where(
      and(
        eq(bookings.googleEventId, booking.googleEventId),
        eq(bookings.status, "confirmed"),
        ne(bookings.uid, booking.uid),
      ),
    );
  if (others.length === 0) {
    await deleteEvent(host, booking.calendarId, booking.googleEventId);
    return;
  }
  const ev = await getEvent(host, booking.calendarId, booking.googleEventId);
  const drop = new Set([booking.email, ...booking.guests].map((e) => e.toLowerCase()));
  await patchEvent(host, booking.calendarId, booking.googleEventId, {
    attendees: (ev.attendees ?? []).filter((a) => !drop.has(a.email?.toLowerCase() ?? "")),
  });
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

  if (booking.googleEventId && booking.calendarId) {
    await patchEvent(host, booking.calendarId, booking.googleEventId, {
      start: { dateTime: start.toISOString(), timeZone: schedule.timezone },
      end: { dateTime: end.toISOString(), timeZone: schedule.timezone },
    });
  }
  const [updated] = await db
    .update(bookings)
    .set({ start, end, timezone })
    .where(eq(bookings.uid, uid))
    .returning();
  return updated;
}

export function formatRange(start: Date, end: Date, tz: string) {
  const s = DateTime.fromJSDate(start).setZone(tz);
  const e = DateTime.fromJSDate(end).setZone(tz);
  return `${s.toFormat("h:mm a")} – ${e.toFormat("h:mm a")}, ${s.toFormat("cccc, LLLL d, yyyy")}`;
}

