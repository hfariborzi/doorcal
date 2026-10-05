import { DateTime } from "luxon";
import type { EventType, Schedule, TimeRange, WeeklyHours } from "@/db/schema";
import type { Interval } from "./google";

export const DEFAULT_WEEKLY: WeeklyHours = {
  "1": [{ start: "09:00", end: "17:00" }],
  "2": [{ start: "09:00", end: "17:00" }],
  "3": [{ start: "09:00", end: "17:00" }],
  "4": [{ start: "09:00", end: "17:00" }],
  "5": [{ start: "09:00", end: "17:00" }],
  "6": [],
  "7": [],
};

export type ExistingBooking = {
  start: Date;
  end: Date;
  eventTypeId: number | null;
  uid: string;
  // false when Google free/busy already covers this booking, so a booking deleted in Google stops blocking
  blocks?: boolean;
};

export type SlotInput = {
  eventType: Pick<
    EventType,
    "id" | "bufferBefore" | "bufferAfter" | "minNotice" | "maxDaysAhead" | "slotInterval" | "dailyLimit" | "seats"
  >;
  schedule: Pick<Schedule, "timezone" | "weekly" | "overrides">;
  duration: number; // minutes
  rangeStart: Date;
  rangeEnd: Date;
  busy: Interval[]; // from Google free/busy
  bookings: ExistingBooking[]; // confirmed bookings for this host overlapping the range
  now?: Date;
  ignoreBookingUid?: string; // when rescheduling, the booking being moved doesn't block itself
};

export type Slot = { start: string; seatsLeft?: number };

function rangesForDate(schedule: SlotInput["schedule"], date: DateTime): TimeRange[] {
  const iso = date.toISODate()!;
  const override = schedule.overrides.find((o) => o.date === iso);
  if (override) return override.ranges;
  return schedule.weekly[String(date.weekday)] ?? [];
}

function atTime(date: DateTime, hhmm: string): DateTime {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === 24) return date.plus({ days: 1 }).startOf("day");
  return date.set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

function subtract(a: Interval, b: Interval): Interval[] {
  if (b.end <= a.start || b.start >= a.end) return [a];
  const out: Interval[] = [];
  if (a.start < b.start) out.push({ start: a.start, end: b.start });
  if (b.end < a.end) out.push({ start: b.end, end: a.end });
  return out;
}

export function computeSlots(input: SlotInput): Slot[] {
  const { eventType, schedule, duration, busy, ignoreBookingUid } = input;
  const tz = schedule.timezone;
  const now = input.now ?? new Date();
  const earliest = now.getTime() + eventType.minNotice * 60_000;
  const latest = DateTime.fromJSDate(now).setZone(tz).plus({ days: eventType.maxDaysAhead }).endOf("day").toMillis();
  const rangeStart = Math.max(input.rangeStart.getTime(), earliest);
  const rangeEnd = Math.min(input.rangeEnd.getTime(), latest);
  if (rangeEnd <= rangeStart) return [];

  const step = (eventType.slotInterval || duration) * 60_000;
  const len = duration * 60_000;
  const before = eventType.bufferBefore * 60_000;
  const after = eventType.bufferAfter * 60_000;
  const isGroup = eventType.seats > 1;

  const bookings = input.bookings.filter((b) => b.uid !== ignoreBookingUid);
  const ignoredBooking = input.bookings.find((b) => b.uid === ignoreBookingUid);

  // Seats taken per start time for this (group) event type.
  const seatsTaken = new Map<number, number>();
  for (const b of bookings) {
    if (b.eventTypeId === eventType.id) {
      const k = b.start.getTime();
      seatsTaken.set(k, (seatsTaken.get(k) ?? 0) + 1);
    }
  }

  // Bookings per day (in schedule tz) for the daily limit. Group sessions count once.
  const perDay = new Map<string, Set<number>>();
  for (const b of bookings) {
    if (b.eventTypeId !== eventType.id) continue;
    const day = DateTime.fromJSDate(b.start).setZone(tz).toISODate()!;
    if (!perDay.has(day)) perDay.set(day, new Set());
    perDay.get(day)!.add(b.start.getTime());
  }

  // Free/busy merges back-to-back events into one block, so cut the moved booking's time out of any
  // busy block that covers it rather than looking for an exact match.
  const busyLeft = ignoredBooking
    ? busy.flatMap((i) => subtract(i, { start: ignoredBooking.start.getTime(), end: ignoredBooking.end.getTime() }))
    : busy;
  const blocking: Interval[] = [
    ...busyLeft,
    ...bookings.filter((b) => b.blocks !== false).map((b) => ({ start: b.start.getTime(), end: b.end.getTime() })),
  ];

  const slots: Slot[] = [];
  let day = DateTime.fromMillis(rangeStart).setZone(tz).startOf("day").minus({ days: 1 });
  const lastDay = DateTime.fromMillis(rangeEnd).setZone(tz).startOf("day").plus({ days: 1 });

  for (; day <= lastDay; day = day.plus({ days: 1 })) {
    const dayKey = day.toISODate()!;
    const dayCount = perDay.get(dayKey)?.size ?? 0;
    for (const r of rangesForDate(schedule, day)) {
      const rStart = atTime(day, r.start).toMillis();
      const rEnd = atTime(day, r.end).toMillis();
      for (let s = rStart; s + len <= rEnd; s += step) {
        if (s < rangeStart || s > rangeEnd) continue;
        const e = s + len;

        if (isGroup) {
          const taken = seatsTaken.get(s) ?? 0;
          if (taken > 0) {
            // Existing group session: joinable until full, regardless of its own calendar block.
            if (taken < eventType.seats) slots.push({ start: new Date(s).toISOString(), seatsLeft: eventType.seats - taken });
            continue;
          }
        }

        if (eventType.dailyLimit && dayCount >= eventType.dailyLimit) continue;
        const bs = s - before;
        const be = e + after;
        if (blocking.some((b) => b.start < be && b.end > bs)) continue;
        slots.push({ start: new Date(s).toISOString(), ...(isGroup ? { seatsLeft: eventType.seats } : {}) });
      }
    }
  }

  slots.sort((a, b) => a.start.localeCompare(b.start));
  return slots.filter((s, i) => i === 0 || s.start !== slots[i - 1].start);
}
