// Load harvested TikTok videos (.captured/<handle>.json) into the DB named by
// .env.scraper, linking each TikTok handle to the creator who owns the given
// Instagram handle. Videos whose caption names an existing place (name or
// alias, longest match wins) are marked matched; the rest stay needs_match.
// Idempotent: re-runs skip existing accounts and videos.
//
//   node scripts/tiktok/load.mjs jajabinx97=jajabinxz [tt=ig ...]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(join(here, "../../.env.scraper"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
if (!SUPABASE_URL || !KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 || res.status === 201 ? null : res.json();
}
const insertIgnore = (table, conflict, rows) =>
  rest(`${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });

const pairs = process.argv.slice(2).map((a) => a.split("="));
if (!pairs.length || pairs.some((p) => p.length !== 2)) {
  console.error("usage: load.mjs <tiktok_handle>=<instagram_handle> ...");
  process.exit(1);
}

const places = await rest("places?select=id,name,name_aliases");
const terms = places
  .flatMap((p) => [p.name, ...(p.name_aliases ?? [])].filter(Boolean).map((t) => ({ id: p.id, t: t.toLowerCase() })))
  .sort((a, b) => b.t.length - a.t.length);
const matchPlace = (caption) => terms.find((x) => caption.toLowerCase().includes(x.t))?.id ?? null;

for (const [tt, ig] of pairs) {
  const [owner] = await rest(`platform_accounts?platform=eq.instagram&handle=eq.${ig}&select=creator_id`);
  if (!owner) throw new Error(`no instagram account '${ig}' to link '${tt}' to`);

  await insertIgnore("platform_accounts", "platform,handle", [
    { id: `tt-${tt}`, creator_id: owner.creator_id, platform: "tiktok", handle: tt, profile_url: `https://www.tiktok.com/@${tt}` },
  ]);

  const videos = JSON.parse(readFileSync(join(here, ".captured", `${tt}.json`), "utf8"));
  const rows = videos.map((v) => {
    const summary = (v.desc || "").replace(/\s+/g, " ").trim().slice(0, 500) || null;
    const placeId = summary ? matchPlace(summary) : null;
    return {
      id: `tt-${v.id}`,
      creator_id: owner.creator_id,
      platform_account_id: `tt-${tt}`,
      platform: "tiktok",
      post_url: v.url,
      media_kind: "reel",
      content_summary: summary,
      posted_at: new Date(v.createTime * 1000).toISOString(),
      place_id: placeId,
      ingest_status: placeId ? "matched" : "needs_match",
    };
  });
  await insertIgnore("posts", "post_url", rows);
  console.log(`${tt}: ${rows.length} videos sent, ${rows.filter((r) => r.place_id).length} matched to existing places`);
}
