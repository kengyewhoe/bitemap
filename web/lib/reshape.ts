// Pure DTO reshapers ported from frontend/js/api.js. No Supabase client, no I/O —
// callers pass in rows already fetched, so these are trivially unit-testable.

import type {
  HalalStatus,
  LatestMention,
  NearbyItem,
  PlaceDetail,
  PriceBand,
  Heat,
} from "./types";

// Shape of a public.place_cards row (plus the nearby_places RPC's distance_km),
// as selected by CARD_COLS in frontend/js/api.js.
export interface PlaceCardRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  area: string | null;
  category: string | null;
  halal_status: HalalStatus;
  price_band: PriceBand | null;
  heat: Heat;
  good_count: number;
  bad_count: number;
  mention_count: number;
  last_mentioned_at: string | null;
  latest_mention_handle: string | null;
  latest_mention_quote: string | null;
  address: string | null;
  name_aliases: string[] | null;
  hours_note: string | null;
  photo_url: string | null;
  photo_credit: string | null;
  provider_place_id: string | null;
  distance_km?: number | null;
}

// good_pct is null under 5 total ratings — contract §8.2 step 4.
export function computeGoodPct(good: number, bad: number): number | null {
  const total = good + bad;
  return total < 5 ? null : Math.round((100 * good) / total);
}

// The view stores handles stripped of '@' (§5); the wire contract carries them
// with the '@' (fixture: "@nomnomswithta").
export function withAt(handle: string | null | undefined): string | null {
  if (!handle) return handle ?? null;
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export function latestMention(row: {
  latest_mention_handle: string | null;
  latest_mention_quote: string | null;
}): LatestMention | null {
  return row.latest_mention_handle
    ? { handle: withAt(row.latest_mention_handle) as string, quote: row.latest_mention_quote }
    : null;
}

// place_cards row → GET /places/nearby item (§8.1).
//
// Unlike api.js, distance_km is NOT computed here via haversine: the Next app
// queries the nearby_places Postgres RPC (BACKEND_REQUIREMENTS.md §8.2), which
// already returns distance_km per row, so this just passes it through.
export function nearbyDto(row: PlaceCardRow): NearbyItem {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    area: row.area,
    category: row.category,
    halal_status: row.halal_status,
    price_band: row.price_band,
    distance_km: row.distance_km ?? null,
    heat: row.heat,
    good_count: row.good_count,
    bad_count: row.bad_count,
    good_pct: computeGoodPct(row.good_count, row.bad_count),
    mention_count: row.mention_count,
    last_mentioned_at: row.last_mentioned_at,
    thumbnail_url: null, // no card thumbnail in the MVP schema
    latest_mention: latestMention(row),
  };
}

// place_cards row → GET /places/:id detail (§8.2). my_vote is layered on by the caller.
export function detailDto(row: PlaceCardRow): PlaceDetail {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    area: row.area,
    category: row.category,
    halal_status: row.halal_status,
    price_band: row.price_band,
    heat: row.heat,
    good_count: row.good_count,
    bad_count: row.bad_count,
    good_pct: computeGoodPct(row.good_count, row.bad_count),
    mention_count: row.mention_count,
    thumbnail_url: null,
    latest_mention: latestMention(row),
    address: row.address,
    name_aliases: row.name_aliases,
    hours_note: row.hours_note,
    photo_url: row.photo_url,
    photo_credit: row.photo_credit,
    provider_place_id: row.provider_place_id,
    my_vote: null,
  };
}
