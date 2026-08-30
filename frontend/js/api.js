// BiteMap API client.
//
// This is the ONE file to change when the real API ships: every screen talks
// to the functions below, which return DTOs shaped exactly like the contract
// in frontend/BACKEND.md / BACKEND_REQUIREMENTS.md §8 (snake_case fields:
// distance_km, good_pct, halal_status, price_band, heat "high"/"medium"/"low",
// last_mentioned_at, latest_mention, thumbnail_url, good_count, bad_count,
// hours_note, ...).
//
// For now the data source is ./fixture.json — a copy of
// seed/fixtures/nomnomswithta.json (keep the two in sync; the seed file is the
// source of truth). Ratings and the session are stubbed onto localStorage via
// session.js, but only through this module's interface, including the
// server-side vote-lock (a second postRating rejects like a 409 VOTE_LOCKED).

import fixture from "./fixture.json";
import { getSession, setSession, clearSession } from "./session.js";

export const KL_CENTER = { lat: 3.139, lng: 101.687 };

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

function localVotes() {
  return getSession()?.votes || {};
}

function requireSession() {
  const s = getSession();
  if (!s?.userId) throw new ApiError(401, "UNAUTHENTICATED", "No valid session.");
  return s;
}

// good_pct is null under 5 total ratings — contract §8.2 step 4.
function computeGoodPct(good, bad) {
  const total = good + bad;
  return total < 5 ? null : Math.round((100 * good) / total);
}

// Overlay the locally-stored vote on fixture counts (the fixture is read-only;
// the real API returns fresh counts itself).
function withLocalVote(dto, placeId) {
  const vote = localVotes()[placeId];
  if (!vote) return dto;
  const good = dto.good_count + (vote === "good" ? 1 : 0);
  const bad = dto.bad_count + (vote === "bad" ? 1 : 0);
  return { ...dto, good_count: good, bad_count: bad, good_pct: computeGoodPct(good, bad), my_vote: vote };
}

// ---------------------------------------------------------------------------
// GET /places/nearby?lat=&lng=&radius_km=5
// ---------------------------------------------------------------------------
// Fixture note: distance_km in the fixture is precomputed from the KL centroid,
// so lat/lng are accepted but not recomputed here. The real endpoint does the
// Haversine + kl_trending fallback server-side.
export async function getPlacesNearby({ lat, lng, radius_km = 5 } = {}) {
  void lat; void lng; void radius_km;
  const res = clone(fixture.places_nearby);
  res.items = res.items.map((item) => {
    const { good_count, bad_count, good_pct } = withLocalVote(item, item.id);
    return { ...item, good_count, bad_count, good_pct };
  });
  return res;
}

// ---------------------------------------------------------------------------
// GET /places/:id
// ---------------------------------------------------------------------------
export async function getPlace(id) {
  const dto = fixture.place_detail[id];
  if (!dto) throw new ApiError(404, "PLACE_NOT_FOUND", "This place isn't on BiteMap yet.");
  return withLocalVote(clone(dto), id);
}

// ---------------------------------------------------------------------------
// GET /places/:id/posts
// ---------------------------------------------------------------------------
export async function getPlacePosts(id) {
  if (!fixture.place_detail[id]) throw new ApiError(404, "PLACE_NOT_FOUND", "This place isn't on BiteMap yet.");
  return clone(fixture.place_posts[id]) || { items: [] };
}

// ---------------------------------------------------------------------------
// POST /places/:id/ratings   { type: "good" | "bad" }
// ---------------------------------------------------------------------------
export async function postRating(placeId, type) {
  requireSession();
  if (!fixture.place_detail[placeId]) throw new ApiError(404, "PLACE_NOT_FOUND", "This place isn't on BiteMap yet.");
  if (type !== "good" && type !== "bad") throw new ApiError(400, "VALIDATION_ERROR", "type must be \"good\" or \"bad\".");
  const votes = { ...localVotes() };
  if (votes[placeId]) throw new ApiError(409, "VOTE_LOCKED", "You already rated this place.");
  votes[placeId] = type;
  setSession({ votes });
  const { good_count, bad_count, good_pct } = withLocalVote(fixture.place_detail[placeId], placeId);
  return { good_count, bad_count, good_pct, my_vote: type };
}

// ---------------------------------------------------------------------------
// GET /places/:id/ratings/me
// ---------------------------------------------------------------------------
// 404 RATING_NOT_FOUND means "not rated yet" — callers treat it as unlocked.
export async function getMyRating(placeId) {
  requireSession();
  const vote = localVotes()[placeId];
  if (!vote) throw new ApiError(404, "RATING_NOT_FOUND", "You haven't rated this place yet.");
  return { type: vote };
}

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------
export async function getMe() {
  const s = requireSession();
  return {
    id: s.userId,
    email: s.email || null,
    display_name: s.displayName || "BiteMap user",
    last_city: s.lastCity || "KL",
    role: s.role || "user",
    created_at: s.createdAt || null,
  };
}

// ---------------------------------------------------------------------------
// Auth — Google only (BACKEND.md:22). No email/OTP/magic-link path exists.
// ---------------------------------------------------------------------------
// TODO(real API): replace the fake session below with
//   await supabase.auth.signInWithOAuth({ provider: "google" })
// once Supabase keys exist; getMe() then confirms the session via GET /me.
export async function signIn() {
  const now = new Date().toISOString();
  const s = setSession({
    userId: "fake-google-user",
    email: "you@gmail.com",
    displayName: "BiteMap user",
    lastCity: "KL",
    role: "user",
    createdAt: getSession()?.createdAt || now,
  });
  void s;
  return getMe();
}

// TODO(real API): await supabase.auth.signOut() before clearing local state.
export async function signOut() {
  clearSession();
}

/* ---------------------------------------------------------------------------
 * Real client (commented out until the API is deployed).
 *
 * Env comes from frontend/.env (see .env.example):
 *   const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
 *   const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
 *
 *   import { createClient } from "@supabase/supabase-js";
 *   const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
 *   const API_BASE = import.meta.env.VITE_API_BASE || SUPABASE_URL + "/functions/v1";
 *
 *   async function request(path, { method = "GET", body } = {}) {
 *     const { data } = await supabase.auth.getSession();
 *     const token = data?.session?.access_token;
 *     const res = await fetch(API_BASE + path, {
 *       method,
 *       headers: {
 *         "Content-Type": "application/json",
 *         ...(token ? { Authorization: `Bearer ${token}` } : {}),
 *       },
 *       body: body ? JSON.stringify(body) : undefined,
 *     });
 *     const json = await res.json().catch(() => null);
 *     if (!res.ok) throw new ApiError(res.status, json?.error?.code || "UNKNOWN", json?.error?.message || res.statusText);
 *     return json;
 *   }
 *
 * Then each fixture-backed function above becomes a one-liner:
 *   getPlacesNearby({ lat, lng, radius_km = 5 }) => request(`/places/nearby?lat=${lat}&lng=${lng}&radius_km=${radius_km}`)
 *   getPlace(id)                                 => request(`/places/${id}`)
 *   getPlacePosts(id)                            => request(`/places/${id}/posts`)
 *   postRating(placeId, type)                    => request(`/places/${placeId}/ratings`, { method: "POST", body: { type } })
 *   getMyRating(placeId)                         => request(`/places/${placeId}/ratings/me`)
 *   getMe()                                      => request(`/me`)
 *   signIn()  => supabase.auth.signInWithOAuth({ provider: "google" })
 *   signOut() => supabase.auth.signOut()
 * ------------------------------------------------------------------------- */

// ===========================================================================
// Display helpers (view layer, KL conventions — km and RM). Not part of the
// wire contract; they translate contract enums into UI strings/classes and
// stay unchanged when the real API replaces the fixture above.
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
