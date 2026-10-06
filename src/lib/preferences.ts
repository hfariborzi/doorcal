/**
 * Booking preferences are soft: they never remove a slot, they only mark some as preferred so the invitee
 * can favour them. Pure helpers; unit tested.
 */
import { DateTime } from "luxon";
import type { BookingPreferences, WeeklyHours } from "@/db/schema";

export const EMPTY_PREFERENCES: BookingPreferences = { locationIndex: null, weekly: null, note: "" };

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** True when the whole slot falls inside one of the preferred windows for its weekday (in `tz`). */
export function isPreferredSlot(startMs: number, durationMin: number, weekly: WeeklyHours | null | undefined, tz: string): boolean {
  if (!weekly) return false;
  const start = DateTime.fromMillis(startMs, { zone: tz });
  const ranges = weekly[String(start.weekday)] ?? [];
  if (!ranges.length) return false;
  const s = start.hour * 60 + start.minute;
  const e = s + durationMin;
  return ranges.some((r) => s >= toMinutes(r.start) && e <= toMinutes(r.end));
}

/** Whether a preference exists at all, so the booking page can skip the "Preferred" grouping otherwise. */
export function hasTimePreference(p: BookingPreferences | null | undefined): boolean {
  return !!p?.weekly && Object.values(p.weekly).some((ranges) => ranges.length > 0);
}
