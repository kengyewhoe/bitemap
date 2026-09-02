import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatDateDMY,
  halalBadge,
  goodPctLabel,
  goodPctShort,
  priceBandLabel,
  heatToPinClass,
  formatKm,
} from "../format";

test("formatDateDMY: handles ISO input", () => {
  // Noon UTC keeps the calendar date stable across the local timezones test
  // runners are likely to use (formatDateDMY reads local Date components, same
  // as api.js).
  assert.equal(formatDateDMY("2026-08-21T12:00:00.000Z"), "21/08/2026");
});

test("formatDateDMY: null on missing input", () => {
  assert.equal(formatDateDMY(null), null);
  assert.equal(formatDateDMY(undefined), null);
});

test("formatDateDMY: null on bad input", () => {
  assert.equal(formatDateDMY("not-a-date"), null);
});

test("halalBadge: known statuses map to their labels", () => {
  assert.equal(halalBadge("jakim_certified").label, "Halal (JAKIM)");
  assert.equal(halalBadge("non_halal").tone, "bad");
});

test("halalBadge: unknown/missing falls back to the unknown badge", () => {
  assert.deepEqual(halalBadge("unknown"), { label: "Halal: not confirmed", tone: "neutral" });
  // @ts-expect-error exercising the runtime fallback for a bad enum value
  assert.deepEqual(halalBadge("garbage"), { label: "Halal: not confirmed", tone: "neutral" });
  assert.deepEqual(halalBadge(null), { label: "Halal: not confirmed", tone: "neutral" });
});

test("goodPctLabel / goodPctShort: null renders as 'new', not 'null%'", () => {
  assert.equal(goodPctLabel(null), "Baru — not enough ratings yet");
  assert.equal(goodPctShort(null), "New");
  assert.equal(goodPctLabel(90), "90% Good");
  assert.equal(goodPctShort(90), "90% Good");
});

test("priceBandLabel: RM labels, never '$'", () => {
  assert.equal(priceBandLabel("under_rm10"), "Under RM10");
  assert.equal(priceBandLabel(null), null);
});

test("heatToPinClass: falls back to medium for unknown heat", () => {
  assert.equal(heatToPinClass("high"), "bg-map-chili shadow-map-chili");
  // @ts-expect-error exercising the runtime fallback for a bad enum value
  assert.equal(heatToPinClass("nonsense"), "bg-map-mango shadow-map-mango");
});

test("formatKm: appends unit", () => {
  assert.equal(formatKm(0.4), "0.4 km");
});
