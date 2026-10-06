import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db, users, schedules, eventTypes, bookings, type EventType, type User, type Schedule } from "@/db";
import { computeSlots, DEFAULT_WEEKLY } from "./availability";
import { hasTimePreference, isPreferredSlot } from "./preferences";
import { busyForAccounts, listAccounts } from "./calendar";

export async function getUserByUsername(username: string): Promise<User | null> {
  const [u] = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  return u ?? null;
}

export async function getEventType(userId: number, slug: string): Promise<EventType | null> {
  const [et] = await db
    .select()
    .from(eventTypes)
    .where(and(eq(eventTypes.userId, userId), eq(eventTypes.slug, slug)))
    .limit(1);
  return et ?? null;
}

export async function listEventTypes(userId: number): Promise<EventType[]> {
  return db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.userId, userId))
    .orderBy(asc(eventTypes.position), asc(eventTypes.id));
}

export async function listSchedules(userId: number): Promise<Schedule[]> {
  return db.select().from(schedules).where(eq(schedules.userId, userId)).orderBy(asc(schedules.id));
}

export async function scheduleFor(user: User, et: Pick<EventType, "scheduleId">): Promise<Schedule> {
  const all = await listSchedules(user.id);
  const found = all.find((s) => s.id === et.scheduleId) ?? all.find((s) => s.isDefault) ?? all[0];
  if (found) return found;
  return (await ensureDefaults(user)).schedule;
}

/** Create a default schedule and starter event types the first time a user signs in. */
export async function ensureDefaults(user: User): Promise<{ schedule: Schedule }> {
  const existing = await listSchedules(user.id);
  if (existing.length) return { schedule: existing.find((s) => s.isDefault) ?? existing[0] };

  const [schedule] = await db
    .insert(schedules)
    .values({ userId: user.id, name: "Working hours", timezone: user.timezone, weekly: DEFAULT_WEEKLY, isDefault: true })
    .returning();

  const hasTypes = (await listEventTypes(user.id)).length > 0;
  if (!hasTypes) {
    await db.insert(eventTypes).values([
      {
        userId: user.id,
        slug: "30min",
        title: "30 Minute Meeting",
        description: "A quick video call.",
        durations: [30],
        locations: [{ type: "online" }],
        color: "#7c3aed",
        scheduleId: schedule.id,
        position: 0,
      },
      {
        userId: user.id,
        slug: "in-person",
        title: "In-Person Meeting",
        description: "Meet face to face.",
        durations: [30, 60],
        locations: [{ type: "in_person", address: "My office" }],
        color: "#16a34a",
        scheduleId: schedule.id,
        position: 1,
      },
    ]);
  }
  return { schedule };
}

export async function confirmedBookingsInRange(userId: number, start: Date, end: Date) {
  return db
    .select({
      start: bookings.start,
      end: bookings.end,
      eventTypeId: bookings.eventTypeId,
      uid: bookings.uid,
      accountId: bookings.accountId,
      calendarId: bookings.calendarId,
      eventId: bookings.eventId,
    })
    .from(bookings)
    .where(
      and(eq(bookings.userId, userId), eq(bookings.status, "confirmed"), lt(bookings.start, end), gt(bookings.end, start)),
    );
}

export async function getSlots(opts: {
  user: User;
  eventType: EventType;
  duration: number;
  rangeStart: Date;
  rangeEnd: Date;
  ignoreBookingUid?: string;
}) {
  const { user, eventType, duration, rangeStart, rangeEnd, ignoreBookingUid } = opts;
  const schedule = await scheduleFor(user, eventType);
  // Pad the lookup window so buffers at the edges are respected.
  const pad = (Math.max(eventType.bufferBefore, eventType.bufferAfter) + duration) * 60_000 + 86_400_000;
  const from = new Date(rangeStart.getTime() - pad);
  const to = new Date(rangeEnd.getTime() + pad);
  const accounts = await listAccounts(user.id);
  const [busy, existing] = await Promise.all([
    busyForAccounts(accounts, from, to, schedule.timezone),
    confirmedBookingsInRange(user.id, from, to),
  ]);
  // A booking whose calendar event sits on a calendar we check for conflicts is already covered by `busy`.
  // Only let the DB row block on its own when the busy lookup can't see it (event not created yet, or written
  // to a calendar that isn't checked). That way bookings deleted in the calendar stop blocking slots.
  const checked = new Set(accounts.flatMap((a) => a.conflictCalendarIds.map((c) => `${a.id}:${c}`)));
  const rows = existing.map((b) => ({
    ...b,
    blocks: !b.eventId || !b.calendarId || !b.accountId || !checked.has(`${b.accountId}:${b.calendarId}`),
  }));
  const slots = computeSlots({ eventType, schedule, duration, rangeStart, rangeEnd, busy, bookings: rows, ignoreBookingUid });
  // Soft preferences: mark slots inside the host's preferred windows; nothing is removed.
  if (hasTimePreference(eventType.preferences)) {
    for (const s of slots) s.preferred = isPreferredSlot(Date.parse(s.start), duration, eventType.preferences!.weekly, schedule.timezone);
  }
  return { schedule, slots };
}
