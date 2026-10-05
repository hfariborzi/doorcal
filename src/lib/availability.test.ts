import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlots, DEFAULT_WEEKLY, type SlotInput } from "./availability.ts";

const TZ = "America/Edmonton";
// Monday 2026-10-05, 06:00 local (12:00Z)
const NOW = new Date("2026-10-05T12:00:00Z");

const baseEt: SlotInput["eventType"] = {
  id: 1,
  bufferBefore: 0,
  bufferAfter: 0,
  minNotice: 0,
  maxDaysAhead: 60,
  slotInterval: null,
  dailyLimit: null,
  seats: 1,
};

function run(overrides: Partial<SlotInput> = {}) {
  return computeSlots({
    eventType: baseEt,
    schedule: { timezone: TZ, weekly: DEFAULT_WEEKLY, overrides: [] },
    duration: 30,
    rangeStart: new Date("2026-10-05T06:00:00Z"),
    rangeEnd: new Date("2026-10-06T06:00:00Z"), // Monday in Edmonton
    busy: [],
    bookings: [],
    now: NOW,
    ...overrides,
  });
}

test("9-5 weekday produces 16 half-hour slots in host time zone", () => {
  const slots = run();
  assert.equal(slots.length, 16);
  assert.equal(slots[0].start, "2026-10-05T15:00:00.000Z"); // 09:00 MDT
  assert.equal(slots.at(-1)!.start, "2026-10-05T22:30:00.000Z"); // 16:30 MDT
});

test("weekends are unavailable by default", () => {
  const slots = run({
    rangeStart: new Date("2026-10-10T06:00:00Z"),
    rangeEnd: new Date("2026-10-12T06:00:00Z"),
  });
  assert.equal(slots.length, 0);
});

test("busy time and buffers block overlapping slots", () => {
  const busy = [{ start: Date.parse("2026-10-05T17:00:00Z"), end: Date.parse("2026-10-05T18:00:00Z") }]; // 11-12
  const plain = run({ busy });
  assert.ok(!plain.some((s) => s.start === "2026-10-05T17:00:00.000Z"));
  assert.ok(!plain.some((s) => s.start === "2026-10-05T17:30:00.000Z"));
  assert.ok(plain.some((s) => s.start === "2026-10-05T16:30:00.000Z"));
  const buffered = run({ busy, eventType: { ...baseEt, bufferAfter: 15 } });
  assert.ok(!buffered.some((s) => s.start === "2026-10-05T16:30:00.000Z"));
});

test("minimum notice hides slots that are too soon", () => {
  const slots = run({ eventType: { ...baseEt, minNotice: 5 * 60 } }); // now 06:00 → earliest 11:00
  assert.equal(slots[0].start, "2026-10-05T17:00:00.000Z");
});

test("date override can block a day or replace hours", () => {
  assert.equal(run({ schedule: { timezone: TZ, weekly: DEFAULT_WEEKLY, overrides: [{ date: "2026-10-05", ranges: [] }] } }).length, 0);
  const custom = run({
    schedule: { timezone: TZ, weekly: DEFAULT_WEEKLY, overrides: [{ date: "2026-10-05", ranges: [{ start: "13:00", end: "14:00" }] }] },
  });
  assert.deepEqual(custom.map((s) => s.start), ["2026-10-05T19:00:00.000Z", "2026-10-05T19:30:00.000Z"]);
});

test("daily limit stops new slots once reached", () => {
  const bookings = [{ start: new Date("2026-10-05T15:00:00Z"), end: new Date("2026-10-05T15:30:00Z"), eventTypeId: 1, uid: "a" }];
  assert.equal(run({ bookings, eventType: { ...baseEt, dailyLimit: 1 } }).length, 0);
});

test("rescheduling ignores the booking being moved", () => {
  const b = { start: new Date("2026-10-05T15:00:00Z"), end: new Date("2026-10-05T15:30:00Z"), eventTypeId: 1, uid: "me" };
  const busy = [{ start: b.start.getTime(), end: b.end.getTime() }];
  assert.ok(!run({ bookings: [b], busy }).some((s) => s.start === "2026-10-05T15:00:00.000Z"));
  assert.ok(run({ bookings: [b], busy, ignoreBookingUid: "me" }).some((s) => s.start === "2026-10-05T15:00:00.000Z"));
});

test("group events stay open until seats run out", () => {
  const et = { ...baseEt, seats: 2 };
  const b = { start: new Date("2026-10-05T15:00:00Z"), end: new Date("2026-10-05T15:30:00Z"), eventTypeId: 1, uid: "a" };
  const busy = [{ start: b.start.getTime(), end: b.end.getTime() }];
  const one = run({ eventType: et, bookings: [b], busy });
  assert.equal(one.find((s) => s.start === "2026-10-05T15:00:00.000Z")?.seatsLeft, 1);
  const full = run({ eventType: et, bookings: [b, { ...b, uid: "b" }], busy });
  assert.ok(!full.some((s) => s.start === "2026-10-05T15:00:00.000Z"));
});

test("DST change keeps slots on local wall-clock time", () => {
  // 2026-11-02 is the Monday after DST ends in North America (MST = UTC-7)
  const slots = run({
    now: new Date("2026-10-30T12:00:00Z"),
    rangeStart: new Date("2026-11-02T07:00:00Z"),
    rangeEnd: new Date("2026-11-03T07:00:00Z"),
  });
  assert.equal(slots[0].start, "2026-11-02T16:00:00.000Z"); // 09:00 MST
});
