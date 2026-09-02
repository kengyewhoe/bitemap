// GET /api/search?q=&lat=&lng= — KL-wide place search, not just the ~11
// nearby cards. Anon client (same pattern as /api/nearby), no cookies.
//
// Matches the term case-insensitively across name, area, and name_aliases.
// name/area are matched server-side via a single .or(...ilike...) query —
// PostgREST rejects ilike directly on name_aliases (text[]; verified
// against the dev project: "operator does not exist: text[] ~~* unknown",
// and PostgREST's `column::cast` filter syntax errors the same way inside
// an .or() logic tree), so aliases are matched with a second, narrow query
// (only rows that have any aliases at all) filtered in JS — the table is
// small (MVP scale), so this stays cheap.
//
// lat/lng are optional and only used to compute distance_km on the results
// (haversine here, matching the nearby_places RPC's rounding) — place_cards
// itself has no distance column, so distance_km is null unless origin is given.
import { NextResponse } from "next/server";
import { nearbyDto, type PlaceCardRow } from "@/lib/reshape";
import { anonClient, errorBody } from "@/app/api/_supabase";

const CARD_COLS =
  "id, name, lat, lng, area, category, halal_status, price_band, heat, " +
  "good_count, bad_count, mention_count, last_mentioned_at, " +
  "latest_mention_handle, latest_mention_quote, address, name_aliases, " +
  "hours_note, photo_url, photo_credit, provider_place_id";

const SEARCH_CACHE_CONTROL = "s-maxage=30, stale-while-revalidate=120";
const RESULT_LIMIT = 20;

// Strip characters that are meaningful to PostgREST's .or()/ilike syntax
// (%, ,, (, )) so a search term can't break out of the filter string or
// forge extra OR clauses. Trims whitespace too.
function sanitizeTerm(raw: string): string {
  return raw.trim().replace(/[%,()]/g, "");
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const km = R * 2 * Math.asin(Math.sqrt(h));
  return Math.round(km * 10) / 10; // 1 decimal place, matching the nearby_places RPC
}

function byRank(a: PlaceCardRow, b: PlaceCardRow): number {
  if (b.mention_count !== a.mention_count) return b.mention_count - a.mention_count;
  return a.name.localeCompare(b.name);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const qParam = searchParams.get("q") ?? "";
  const term = sanitizeTerm(qParam);

  if (!term) {
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": SEARCH_CACHE_CONTROL } });
  }

  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const lat = latParam !== null ? Number(latParam) : null;
  const lng = lngParam !== null ? Number(lngParam) : null;
  const origin =
    lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  const supabase = anonClient();

  const [nameAreaResult, aliasCandidatesResult] = await Promise.all([
    supabase
      .from("place_cards")
      .select(CARD_COLS)
      .or(`name.ilike.%${term}%,area.ilike.%${term}%`)
      .limit(RESULT_LIMIT),
    supabase.from("place_cards").select(CARD_COLS).not("name_aliases", "is", null),
  ]);

  if (nameAreaResult.error || aliasCandidatesResult.error) {
    console.error(
      "GET /api/search: place_cards query failed",
      nameAreaResult.error ?? aliasCandidatesResult.error
    );
    return NextResponse.json(
      errorBody("DB_ERROR", "Something went wrong."),
      { status: 500 }
    );
  }

  const lowerTerm = term.toLowerCase();
  const aliasMatches = ((aliasCandidatesResult.data ?? []) as unknown as PlaceCardRow[]).filter((row) =>
    (row.name_aliases ?? []).some((alias) => alias.toLowerCase().includes(lowerTerm))
  );

  const byId = new Map<string, PlaceCardRow>();
  for (const row of (nameAreaResult.data ?? []) as unknown as PlaceCardRow[]) byId.set(row.id, row);
  for (const row of aliasMatches) byId.set(row.id, row);

  const rows = Array.from(byId.values()).sort(byRank).slice(0, RESULT_LIMIT);
  const items = rows.map((row) => {
    const distance_km = origin ? haversineKm(origin, { lat: row.lat, lng: row.lng }) : null;
    return nearbyDto({ ...row, distance_km });
  });

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": SEARCH_CACHE_CONTROL } }
  );
}
