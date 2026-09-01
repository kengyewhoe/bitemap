// BiteMap API client.
//
// Talks directly to Supabase (PostgREST + Auth) — there is no REST layer at
// /functions/v1. Every screen calls the functions below, which return DTOs
// shaped exactly like the contract in frontend/BACKEND.md / BACKEND_REQUIREMENTS.md
// §8 (snake_case: distance_km, good_pct, halal_status, price_band,
// heat "high"/"medium"/"low", last_mentioned_at, latest_mention, thumbnail_url,
// good_count, bad_count, hours_note, ...).
//
// Data source:
//   - Reads (nearby/place/posts) query the public.place_cards view and posts
//     table as the anon role — the view is security_invoker, so RLS
//     (published places, renderable posts) is enforced by the DB.
//   - Ratings insert into public.user_ratings as the authenticated role; the
//     unique (user_id, place_id) constraint is the vote lock: Postgres 23505
//     surfaces here as 409 VOTE_LOCKED.
//   - Auth is Google-only via supabase.auth.signInWithOAuth (BACKEND.md:22).
//
// distance_km, good_pct and latest_mention are derived here from view columns;
// see the reshapers below.

import { createClient } from "@supabase/supabase-js";
import { getSession, setSession } from "./session.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const KL_CENTER = { lat: 3.139, lng: 101.687 };

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// The client exists only when env is configured, so display-only pages (which
// import the helpers at the bottom of this file) still render before keys land.
// Data calls without a client throw CONFIG_MISSING rather than crashing at import.
export const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

// Mirror the Supabase identity into the local session so session.js's
// synchronous requireAuth() guard keeps working. Parked prefs (saved/following/
// location) in the same store are left untouched.
if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) setSession({ userId: session.user.id, email: session.user.email || null });
    else setSession({ userId: null, email: null });
  });
}

function db() {
  if (!supabase) {
    throw new ApiError(500, "CONFIG_MISSING", "Supabase not configured — copy frontend/.env.example to frontend/.env.");
  }
  return supabase;
}

// Generic PostgREST/Auth error → ApiError. Specific codes (23505/23503) are
// mapped by their callers before this is reached.
function toApiError(error, fallbackStatus = 400) {
  return new ApiError(fallbackStatus, error?.code || "DB_ERROR", error?.message || "Request failed.");
}

async function currentUserId() {
  const { data } = await db().auth.getSession();
  return data?.session?.user?.id || null;
}

// good_pct is null under 5 total ratings — contract §8.2 step 4.
function computeGoodPct(good, bad) {
  const total = good + bad;
  return total < 5 ? null : Math.round((100 * good) / total);
}

// The view stores handles stripped of '@' (§5); the wire contract carries them
// with the '@' (fixture: "@nomnomswithta").
function withAt(handle) {
  if (!handle) return handle;
  return handle.startsWith("@") ? handle : `@${handle}`;
}

// Haversine, km. distance_km is not stored — computed from the query origin.
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

function latestMention(row) {
  return row.latest_mention_handle
    ? { handle: withAt(row.latest_mention_handle), quote: row.latest_mention_quote }
    : null;
}

const CARD_COLS =
  "id, name, lat, lng, area, category, halal_status, price_band, heat, " +
  "good_count, bad_count, mention_count, last_mentioned_at, " +
  "latest_mention_handle, latest_mention_quote, address, name_aliases, " +
  "hours_note, photo_url, photo_credit, provider_place_id";

// place_cards row → GET /places/nearby item (§8.1).
function nearbyDto(row, origin) {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    area: row.area,
    category: row.category,
    halal_status: row.halal_status,
    price_band: row.price_band,
    distance_km: origin ? haversineKm(origin.lat, origin.lng, row.lat, row.lng) : null,
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

// place_cards row → GET /places/:id detail (§8.2). my_vote is layered on by getPlace.
function detailDto(row) {
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

// ---------------------------------------------------------------------------
// GET /places/nearby?lat=&lng=&radius_km=5
// ---------------------------------------------------------------------------
// RLS returns only published places. Distance is computed here; if nothing sits
// within the radius we fall back to a KL-trending list (all places, by mention
// count) so the map is never empty — contract §8.1 fallback.
export async function getPlacesNearby({ lat, lng, radius_km = 5 } = {}) {
  const origin = lat != null && lng != null ? { lat, lng } : KL_CENTER;
  const { data, error } = await db().from("place_cards").select(CARD_COLS);
  if (error) throw toApiError(error);

  const items = (data || [])
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => nearbyDto(r, origin));

  const inRadius = items.filter((i) => i.distance_km <= radius_km);
  if (inRadius.length) {
    inRadius.sort((a, b) => a.distance_km - b.distance_km);
    return { items: inRadius };
  }
  // kl_trending fallback: keep distances, order by mention count.
  items.sort((a, b) => b.mention_count - a.mention_count);
  return { items };
}

// ---------------------------------------------------------------------------
// GET /places/:id
// ---------------------------------------------------------------------------
export async function getPlace(id) {
  const { data, error } = await db().from("place_cards").select(CARD_COLS).eq("id", id).maybeSingle();
  if (error) throw toApiError(error);
  if (!data) throw new ApiError(404, "PLACE_NOT_FOUND", "This place isn't on BiteMap yet.");

  const dto = detailDto(data);
  // RLS on user_ratings limits the select to the caller's own row.
  if (await currentUserId()) {
    const { data: mine } = await db()
      .from("user_ratings")
      .select("rating_type")
      .eq("place_id", id)
      .maybeSingle();
    dto.my_vote = mine?.rating_type || null;
  }
  return dto;
}

// ---------------------------------------------------------------------------
// GET /places/:id/posts
// ---------------------------------------------------------------------------
// RLS on posts already restricts to renderable, non-self-interest posts on a
// published place; the explicit filters mirror the place_cards definition.
export async function getPlacePosts(id) {
  const { data: place, error: placeErr } = await db()
    .from("place_cards")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (placeErr) throw toApiError(placeErr);
  if (!place) throw new ApiError(404, "PLACE_NOT_FOUND", "This place isn't on BiteMap yet.");

  const { data, error } = await db()
    .from("posts")
    .select(
      "id, platform, post_url, thumbnail_url, media_kind, posted_at, is_sponsored, " +
        "content_summary, creators!inner(id, display_name, avatar_url), " +
        "platform_accounts!inner(handle)"
    )
    .eq("place_id", id)
    .eq("is_self_interest", false)
    .in("ingest_status", ["ready", "matched"])
    .order("posted_at", { ascending: false });
  if (error) throw toApiError(error);

  const items = (data || []).map((p) => ({
    id: p.id,
    platform: p.platform,
    post_url: p.post_url,
    thumbnail_url: p.thumbnail_url,
    media_kind: p.media_kind,
    posted_at: p.posted_at,
    is_sponsored: p.is_sponsored,
    content_summary: p.content_summary,
    creator: {
      id: p.creators?.id,
      handle: withAt(p.platform_accounts?.handle),
      display_name: p.creators?.display_name,
      avatar_url: p.creators?.avatar_url,
    },
  }));
  return { items };
}

// ---------------------------------------------------------------------------
// POST /places/:id/ratings   { type: "good" | "bad" }
// ---------------------------------------------------------------------------
export async function postRating(placeId, type) {
  const userId = await currentUserId();
  if (!userId) throw new ApiError(401, "UNAUTHENTICATED", "No valid session.");
  if (type !== "good" && type !== "bad") {
    throw new ApiError(400, "VALIDATION_ERROR", 'type must be "good" or "bad".');
  }

  const { error } = await db()
    .from("user_ratings")
    .insert({ user_id: userId, place_id: placeId, rating_type: type });
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "VOTE_LOCKED", "You already rated this place.");
    if (error.code === "23503") throw new ApiError(404, "PLACE_NOT_FOUND", "This place isn't on BiteMap yet.");
    throw toApiError(error);
  }

  // Fresh counts from the view (derived, not stored).
  const { data, error: readErr } = await db()
    .from("place_cards")
    .select("good_count, bad_count")
    .eq("id", placeId)
    .maybeSingle();
  if (readErr) throw toApiError(readErr);
  const good = data?.good_count ?? 0;
  const bad = data?.bad_count ?? 0;
  return { good_count: good, bad_count: bad, good_pct: computeGoodPct(good, bad), my_vote: type };
}

// ---------------------------------------------------------------------------
// GET /places/:id/ratings/me
// ---------------------------------------------------------------------------
// 404 RATING_NOT_FOUND means "not rated yet" — callers treat it as unlocked.
export async function getMyRating(placeId) {
  const userId = await currentUserId();
  if (!userId) throw new ApiError(401, "UNAUTHENTICATED", "No valid session.");
  const { data, error } = await db()
    .from("user_ratings")
    .select("rating_type")
    .eq("place_id", placeId)
    .maybeSingle();
  if (error) throw toApiError(error);
  if (!data) throw new ApiError(404, "RATING_NOT_FOUND", "You haven't rated this place yet.");
  return { type: data.rating_type };
}

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------
export async function getMe() {
  const { data: auth } = await db().auth.getUser();
  const user = auth?.user;
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "No valid session.");

  const { data, error } = await db()
    .from("users")
    .select("display_name, last_city, role, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw toApiError(error);
  return {
    id: user.id,
    email: user.email || null,
    display_name: data?.display_name || "BiteMap user",
    last_city: data?.last_city || "KL",
    role: data?.role || "user",
    created_at: data?.created_at || null,
  };
}

// ---------------------------------------------------------------------------
// Auth — Google only (BACKEND.md:22). No email/OTP/magic-link path.
// ---------------------------------------------------------------------------
// signInWithOAuth redirects the browser to Google and back to redirectTo, where
// detectSessionInUrl establishes the session and onAuthStateChange mirrors it.
export async function signIn() {
  const redirectTo = new URL("./location.html", window.location.href).href;
  const { error } = await db().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error) throw toApiError(error);
}

export async function signOut() {
  const { error } = await db().auth.signOut();
  if (error) throw toApiError(error);
  setSession({ userId: null, email: null });
}

// ===========================================================================
// Display helpers (view layer, KL conventions — km and RM). Not part of the
// wire contract; they translate contract enums into UI strings/classes.
// ===========================================================================

// API heat → existing pin CSS classes (BACKEND.md:40-48).
const HEAT_PIN_CLASS = {
  high: "bg-map-chili shadow-map-chili",
  medium: "bg-map-mango shadow-map-mango",
  low: "bg-map-lime",
};
export function heatToPinClass(heat) {
  return HEAT_PIN_CLASS[heat] || HEAT_PIN_CLASS.medium;
}

// price_band enum → RM display labels (never "$").
const PRICE_BAND_LABELS = {
  under_rm10: "Under RM10",
  rm10_25: "RM10–25",
  rm25_50: "RM25–50",
  rm50_plus: "RM50+",
};
export function priceBandLabel(band) {
  return band ? PRICE_BAND_LABELS[band] || null : null;
}

// halal_status 5-value enum. "unknown" renders plainly, never as "Non-halal".
export const HALAL_FRIENDLY = new Set(["jakim_certified", "muslim_owned", "pork_free"]);
const HALAL_BADGES = {
  jakim_certified: { label: "Halal (JAKIM)", tone: "good" },
  muslim_owned: { label: "Muslim-owned", tone: "good" },
  pork_free: { label: "Pork-free", tone: "good" },
  non_halal: { label: "Non-halal", tone: "bad" },
  unknown: { label: "Halal: not confirmed", tone: "neutral" },
};
export function halalBadge(status) {
  return HALAL_BADGES[status] || HALAL_BADGES.unknown;
}

// good_pct can be null (< 5 ratings) — never render "null% Good".
export function goodPctLabel(good_pct) {
  return good_pct == null ? "Baru — not enough ratings yet" : `${good_pct}% Good`;
}
export function goodPctShort(good_pct) {
  return good_pct == null ? "New" : `${good_pct}% Good`;
}

export function formatKm(distance_km) {
  return `${distance_km} km`;
}

// Display dates as DD/MM/YYYY (wire format stays ISO 8601).
export function formatDateDMY(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
