import { test } from "node:test";
import assert from "node:assert/strict";

import { computeGoodPct, withAt, nearbyDto, latestMention } from "../reshape";
import type { PlaceCardRow } from "../reshape";

test("computeGoodPct: null under 5 total ratings", () => {
  assert.equal(computeGoodPct(2, 2), null); // total 4
  assert.equal(computeGoodPct(0, 0), null);
  assert.equal(computeGoodPct(4, 0), null); // total 4
});

test("computeGoodPct: rounds correctly at >=5 total", () => {
  assert.equal(computeGoodPct(18, 2), 90); // total 20
  assert.equal(computeGoodPct(5, 4), 56); // 55.55.. -> 56
  assert.equal(computeGoodPct(1, 4), 20); // total 5, exactly boundary
});

test("withAt: adds '@' only when missing", () => {
  assert.equal(withAt("nomnomswithta"), "@nomnomswithta");
  assert.equal(withAt("@nomnomswithta"), "@nomnomswithta");
});

test("withAt: passes through falsy handles", () => {
  assert.equal(withAt(null), null);
  assert.equal(withAt(undefined), null);
  assert.equal(withAt(""), "");
});

test("latestMention: null when no handle", () => {
  assert.equal(
    latestMention({ latest_mention_handle: null, latest_mention_quote: "quote" }),
    null
  );
});

test("latestMention: shapes handle+quote when present", () => {
  const result = latestMention({
    latest_mention_handle: "nomnomswithta",
    latest_mention_quote: "Tom yum is the must-order.",
  });
  assert.deepEqual(result, {
    handle: "@nomnomswithta",
    quote: "Tom yum is the must-order.",
  });
});

const baseRow: PlaceCardRow = {
  id: "since-then",
  name: "Since Then",
  lat: 3.1291,
  lng: 101.6779,
  area: "Bangsar",
  category: "Thai",
  halal_status: "unknown",
  price_band: "rm25_50",
  heat: "high",
  good_count: 18,
  bad_count: 2,
  mention_count: 3,
  last_mentioned_at: "2026-08-21T00:00:00+08:00",
  latest_mention_handle: "nomnomswithta",
  latest_mention_quote: "Tom yum is the must-order.",
  address: "12, Jalan Telawi 3",
  name_aliases: null,
  hours_note: null,
  photo_url: null,
  photo_credit: null,
  provider_place_id: null,
  distance_km: 0.4,
};

test("nearbyDto: passes distance_km through from the row (no haversine)", () => {
  const dto = nearbyDto(baseRow);
  assert.equal(dto.distance_km, 0.4);
});

test("nearbyDto: distance_km is null when the row omits it", () => {
  const { distance_km, ...rest } = baseRow;
  const dto = nearbyDto(rest as PlaceCardRow);
  assert.equal(dto.distance_km, null);
});

test("nearbyDto: thumbnail_url is always null (no card thumbnail in MVP schema)", () => {
  const dto = nearbyDto(baseRow);
  assert.equal(dto.thumbnail_url, null);
});
