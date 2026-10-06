import { test } from "node:test";
import assert from "node:assert/strict";
import { hasTimePreference, isPreferredSlot } from "./preferences.ts";

const TZ = "America/Edmonton";
// Mornings on Mondays and Tuesdays (ISO weekdays 1 and 2).
const weekly = { "1": [{ start: "09:00", end: "12:00" }], "2": [{ start: "09:00", end: "12:00" }] };

test("a slot inside a preferred window on a preferred day is preferred", () => {
  const monday10 = Date.parse("2026-10-05T16:00:00Z"); // 10:00 MDT
  assert.equal(isPreferredSlot(monday10, 30, weekly, TZ), true);
});

test("a slot that runs past the window, or on another day, is not preferred", () => {
  const monday1145 = Date.parse("2026-10-05T17:45:00Z"); // 11:45–12:15 MDT
  assert.equal(isPreferredSlot(monday1145, 30, weekly, TZ), false);
  const wednesday10 = Date.parse("2026-10-07T16:00:00Z");
  assert.equal(isPreferredSlot(wednesday10, 30, weekly, TZ), false);
});

test("preference is evaluated in the schedule's time zone", () => {
  const monday10Edmonton = Date.parse("2026-10-05T16:00:00Z");
  assert.equal(isPreferredSlot(monday10Edmonton, 30, weekly, "Europe/London"), false); // 17:00 there
});

test("empty or missing windows mean no time preference", () => {
  assert.equal(hasTimePreference(null), false);
  assert.equal(hasTimePreference({ locationIndex: 0, weekly: { "1": [] }, note: "" }), false);
  assert.equal(hasTimePreference({ locationIndex: null, weekly, note: "" }), true);
  assert.equal(isPreferredSlot(Date.now(), 30, null, TZ), false);
});
