// Turn extracted venues (.captured/<handle>.venues.json) into map places.
// Geocodes each venue with Google Places Text Search, creates a published place
// row for new venues (reuses an existing place with the same name or Google id),
// and links the creator's TikTok videos to it. Venues outside the Klang Valley,
// low-confidence names, and weak name matches go to .captured/<handle>.review.json
// instead. Google results are cached in .captured/places-cache.json.
//
//   node scripts/tiktok/places.mjs <handle> [--dry-run]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
function loadEnv(path) {
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv(join(root, ".env.scraper"));
loadEnv(join(root, "web/.env.local"));
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY, GOOGLE_MAPS_API_KEY: GKEY } = process.env;
if (!SUPABASE_URL || !KEY || !GKEY) throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_API_KEY required");

const [handle, flag] = process.argv.slice(2);
if (!handle) {
  console.error("usage: places.mjs <handle> [--dry-run]");
  process.exit(1);
}
const DRY = flag === "--dry-run";
const cap = (f) => join(here, ".captured", f);

// Klang Valley bounding box; results outside it are not "near" our users yet.
const KV = { low: { latitude: 2.75, longitude: 101.2 }, high: { latitude: 3.5, longitude: 101.95 } };
const inKV = ({ latitude: a, longitude: o }) =>
  a >= KV.low.latitude && a <= KV.high.latitude && o >= KV.low.longitude && o <= KV.high.longitude;

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 || res.status === 201 ? null : res.json();
}

const cachePath = cap("places-cache.json");
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
async function searchPlace(query) {
  if (!(query in cache)) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GKEY,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.primaryTypeDisplayName",
      },
      body: JSON.stringify({ textQuery: query, regionCode: "MY", locationBias: { rectangle: KV } }),
    });
    if (!res.ok) throw new Error(`Places ${res.status}: ${await res.text()}`);
    cache[query] = (await res.json()).places?.[0] ?? null;
    writeFileSync(cachePath, JSON.stringify(cache, null, 1));
  }
  return cache[query];
}

const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const slug = (s) => norm(s).replace(/ /g, "-");
// Weak-match guard: Google's name must share a meaningful word with ours.
const STOP = new Set(["the", "restaurant", "restoran", "cafe", "kopitiam", "and", "by", "at", "of", "kedai", "makan"]);
// Also compares with spaces removed, so "Hotcrush" matches "HOT CRUSH" and
// "Pal Gae Ook" matches "Palgaeook".
const sharesWord = (a, b) => {
  const wa = new Set(norm(a).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
  const ca = norm(a).replace(/ /g, ""), cb = norm(b).replace(/ /g, "");
  return norm(b).split(" ").some((w) => wa.has(w)) || cb.includes(ca) || ca.includes(cb) || (ca.length >= 5 && cb.startsWith(ca.slice(0, 5)));
};
// A stall inside a kopitiam geocodes to the kopitiam: accept when Google's name
// matches the outlet we were given instead of the stall name.
// Only when the outlet is itself an eatery, or "Puchong" would match anything in Puchong.
const EATERY = /kopitiam|restoran|restaurant|food court|medan selera|hawker/i;
const nameMatches = (g, gname) =>
  sharesWord(g.venue, gname) || (EATERY.test(g.branch_or_area ?? "") && sharesWord(g.branch_or_area.replace(EATERY, ""), gname));
const STATUS = { OPERATIONAL: "operational", CLOSED_TEMPORARILY: "closed_temporarily", CLOSED_PERMANENTLY: "closed_permanently" };

const venues = JSON.parse(readFileSync(cap(`${handle}.venues.json`), "utf8"));
const existing = await rest("places?select=id,name,provider_place_id");
const byName = new Map(existing.map((p) => [norm(p.name), p.id]));
const byGoogle = new Map(existing.filter((p) => p.provider_place_id).map((p) => [p.provider_place_id, p.id]));
const takenIds = new Set(existing.map((p) => p.id));

// Group videos by venue + outlet so repeat visits share one place.
const groups = new Map();
for (const v of venues) {
  if (v.kind !== "venue" || !v.venue) continue;
  const key = `${norm(v.venue)}|${norm(v.branch_or_area)}`;
  if (!groups.has(key)) groups.set(key, { ...v, videoIds: [] });
  groups.get(key).videoIds.push(v.id);
}

const review = [];
const newPlaces = [];
const links = []; // { videoIds, placeId }
for (const g of groups.values()) {
  if (g.confidence === "low") {
    review.push({ venue: g.venue, area: g.branch_or_area, reason: "low-confidence name", videos: g.videoIds });
    continue;
  }
  const query = [g.venue, g.branch_or_area, g.city, "Malaysia"].filter(Boolean).join(" ");
  const hit = await searchPlace(query);
  if (!hit) {
    review.push({ venue: g.venue, area: g.branch_or_area, reason: "no Google result", query, videos: g.videoIds });
    continue;
  }
  const gname = hit.displayName?.text ?? "";
  const reason = !inKV(hit.location)
    ? "outside Klang Valley"
    : !nameMatches(g, gname)
      ? `weak name match: Google says "${gname}"`
      : hit.businessStatus === "CLOSED_PERMANENTLY"
        ? "permanently closed"
        : null;
  if (reason) {
    review.push({ venue: g.venue, area: g.branch_or_area, reason, google: { name: gname, address: hit.formattedAddress }, videos: g.videoIds });
    continue;
  }

  let placeId = byGoogle.get(hit.id) ?? byName.get(norm(g.venue)) ?? byName.get(norm(gname));
  if (!placeId) {
    placeId = slug(g.venue);
    if (takenIds.has(placeId)) placeId = slug(`${g.venue} ${g.branch_or_area ?? g.city ?? hit.id.slice(-6)}`);
    takenIds.add(placeId);
    byGoogle.set(hit.id, placeId);
    newPlaces.push({
      id: placeId,
      provider_place_id: hit.id,
      name: g.venue,
      name_aliases: norm(gname) !== norm(g.venue) ? [gname] : null,
      lat: hit.location.latitude,
      lng: hit.location.longitude,
      address: hit.formattedAddress ?? null,
      area: g.branch_or_area ?? null,
      category: hit.primaryTypeDisplayName?.text ?? null,
      operational_status: STATUS[hit.businessStatus] ?? "unknown",
      status: "published",
      notes: `tiktok:${handle} via places.mjs`,
    });
  }
  links.push({ videoIds: g.videoIds, placeId });
}

writeFileSync(cap(`${handle}.review.json`), JSON.stringify(review, null, 2));
const linked = links.reduce((n, l) => n + l.videoIds.length, 0);
console.log(
  `${handle}: ${groups.size} venues -> ${newPlaces.length} new places, ${links.length - newPlaces.length} reused, ` +
    `${review.length} to review; ${linked} videos linked${DRY ? " (dry run, nothing written)" : ""}`,
);
if (DRY) process.exit(0);

if (newPlaces.length) {
  await rest("places?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(newPlaces),
  });
}
for (const { videoIds, placeId } of links) {
  const ids = videoIds.map((id) => `tt-${id}`).join(",");
  await rest(`posts?id=in.(${ids})`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ place_id: placeId, ingest_status: "matched", updated_at: new Date().toISOString() }),
  });
}
console.log("written");
