// GET /api/nearby?lat=&lng=&radius_km=5 — BACKEND_REQUIREMENTS.md §8.2.
//
// Edge-cached, anon-only. Calls the nearby_places(p_lat, p_lng, p_radius_km)
// Postgres RPC (supabase/migrations/20260902000000_nearby_places.sql), which
// already returns distance_km per row — nearbyDto just passes it through, no
// client-side haversine.
import { NextResponse } from "next/server";
import { nearbyDto, type PlaceCardRow } from "@/lib/reshape";
import { anonClient, errorBody, READ_CACHE_CONTROL } from "@/app/api/_supabase";

const KL_CENTER = { lat: 3.139, lng: 101.687 };
const DEFAULT_RADIUS_KM = 5;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const radiusParam = searchParams.get("radius_km");

  const lat = latParam !== null ? Number(latParam) : KL_CENTER.lat;
  const lng = lngParam !== null ? Number(lngParam) : KL_CENTER.lng;
  const radiusKm = radiusParam !== null ? Number(radiusParam) : DEFAULT_RADIUS_KM;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusKm)) {
    return NextResponse.json(
      errorBody("VALIDATION_ERROR", "lat/lng/radius_km must be numbers."),
      { status: 400 }
    );
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      errorBody("VALIDATION_ERROR", "lat must be between -90 and 90; lng must be between -180 and 180."),
      { status: 400 }
    );
  }

  const clampedRadiusKm = Math.min(Math.max(radiusKm, 0), 50);

  const supabase = anonClient();
  const { data, error } = await supabase.rpc("nearby_places", {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: clampedRadiusKm,
  });

  if (error) {
    console.error("GET /api/nearby: nearby_places RPC failed", error);
    return NextResponse.json(
      errorBody("DB_ERROR", "Something went wrong."),
      { status: 500 }
    );
  }

  const rows = (data ?? []) as PlaceCardRow[];
  const items = rows.map(nearbyDto);

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": READ_CACHE_CONTROL } }
  );
}
