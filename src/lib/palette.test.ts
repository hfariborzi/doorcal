import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAPHITE, MIDORE_PALETTE, toPalette } from "./palette.ts";

test("palette colours map to themselves", () => {
  for (const c of MIDORE_PALETTE) assert.equal(toPalette(c), c);
});

test("outside colours land on a nearby Midore shade", () => {
  assert.equal(toPalette("#22c55e"), "#557563"); // bright green -> sage
  assert.equal(toPalette("#a3e635"), "#7d9550"); // lime -> moss
  assert.equal(toPalette("#38bdf8"), "#4a6a8c"); // sky -> slate
  assert.equal(toPalette("#f59e0b"), "#f5a524"); // amber -> amber
  assert.equal(toPalette("#dc2626"), "#e11d48"); // red -> vermilion
  assert.equal(toPalette("#8b5cf6"), "#6b5bb5"); // violet -> iris
});

test("greys, empty and invalid colours become graphite", () => {
  assert.equal(toPalette("#64748b"), GRAPHITE);
  assert.equal(toPalette(""), GRAPHITE);
  assert.equal(toPalette("teal"), GRAPHITE);
});
