import { test } from "node:test";
import assert from "node:assert/strict";
import { effectivePriority, eventKey, locationKind, matchRule, normalizeTitle } from "./core.ts";

test("titles are normalised before matching or hashing", () => {
  assert.equal(normalizeTitle("  Team   Standup "), "team standup");
});

test("recurring instances share one key", () => {
  assert.equal(eventKey({ id: "abc_20261006", seriesId: "abc" }), "abc");
  assert.equal(eventKey({ id: "solo" }), "solo");
});

test("location is read from the event itself", () => {
  assert.equal(locationKind({ meetLink: "https://meet.google.com/x" }), "video");
  assert.equal(locationKind({ location: "https://zoom.us/j/1" }), "video");
  assert.equal(locationKind({ location: "EB 3021" }), "in_person");
  assert.equal(locationKind({ location: "  " }), "unspecified");
  assert.equal(locationKind({}), "unspecified");
});

test("the first matching rule wins, case-insensitively, in position order", () => {
  const rules = [
    { id: 2, pattern: "standup", position: 1 },
    { id: 1, pattern: "Team", position: 0 },
    { id: 3, pattern: "gym", position: 2 },
  ];
  assert.equal(matchRule(rules, "Team standup")?.id, 1);
  assert.equal(matchRule(rules, "Daily STANDUP")?.id, 2);
  assert.equal(matchRule(rules, "Lunch"), null);
});

test("priority falls back from label to category default to normal", () => {
  assert.equal(effectivePriority({ priority: "high" }, { defaultPriority: "low" }), "high");
  assert.equal(effectivePriority({ priority: null }, { defaultPriority: "low" }), "low");
  assert.equal(effectivePriority(null, null), "normal");
});
