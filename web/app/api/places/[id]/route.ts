// GET /api/places/:id — BACKEND_REQUIREMENTS.md §8.3.
//
// Edge-cached, anon-only, shared across all users. CRITICAL: my_vote must
// NEVER be populated here — it's per-user, and this response sits behind a
// shared s-maxage cache, so baking one caller's vote in would leak it to
// every other caller who hits the cache. detailDto already defaults my_vote
// to null; the place page fetches the caller's own vote separately via a
// direct authenticated (uncached) query.
import { NextResponse } from "next/server";
import { detailDto, type PlaceCardRow } from "@/lib/reshape";
import { anonClient, errorBody, PLACE_NOT_FOUND, READ_CACHE_CONTROL } from "@/app/api/_supabase";

const CARD_COLS =
  "id, name, lat, lng, area, category, halal_status, price_band, heat, " +
  "good_count, bad_count, mention_count, last_mentioned_at, " +
  "latest_mention_handle, latest_mention_quote, address, name_aliases, " +
  "hours_note, photo_url, photo_credit, provider_place_id";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = anonClient();

  const { data, error } = await supabase
    .from("place_cards")
    .select(CARD_COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(errorBody("DB_ERROR", error.message), { status: 400 });
  }
  if (!data) {
    return NextResponse.json(PLACE_NOT_FOUND, { status: 404 });
  }

  const dto = detailDto(data as unknown as PlaceCardRow);

  return NextResponse.json(dto, { headers: { "Cache-Control": READ_CACHE_CONTROL } });
}
