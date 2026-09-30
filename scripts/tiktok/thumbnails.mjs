// Back-fill posts.thumbnail_url for a TikTok creator's videos, into the DB
// named by .env.scraper. TikTok cover URLs are signed and expire, so this
// tries the cover captured in .captured/<handle>.raw.json first, then falls
// back to TikTok's public oEmbed endpoint. Either way the bytes are re-hosted
// into Supabase Storage (same "thumbnails" bucket the Instagram pipeline
// uses, under a tiktok/ prefix) so the stored url never expires.
// Idempotent: only posts with a null thumbnail_url are touched.
//
//   node scripts/tiktok/thumbnails.mjs <handle>
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

const BUCKET = "thumbnails";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 || res.status === 201 ? null : res.json();
}

async function ensureBucket(name) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: name, name, public: true }),
  });
  if (res.ok) return;
  const body = await res.text();
  if (res.status === 409 || /already exists|Duplicate/i.test(body)) return;
  throw new Error(`ensureBucket(${name}): HTTP ${res.status} ${body}`);
}

async function uploadImage(path, bytes, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`upload ${BUCKET}/${path}: HTTP ${res.status} ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function fetchBytes(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { bytes, contentType };
}

async function oembedThumbnail(postUrl) {
  const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(postUrl)}`);
  if (!res.ok) throw new Error(`oembed HTTP ${res.status}`);
  const data = await res.json();
  if (!data.thumbnail_url) throw new Error("oembed: no thumbnail_url");
  return data.thumbnail_url;
}

const [handle] = process.argv.slice(2);
if (!handle) {
  console.error("usage: thumbnails.mjs <handle>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(join(here, ".captured", `${handle}.raw.json`), "utf8"));
const covers = new Map(
  raw.map((it) => [it.id, it.video?.cover ?? it.video?.originCover ?? it.video?.dynamicCover ?? null]),
);

async function main() {
  await ensureBucket(BUCKET);

  const posts = await rest(
    `posts?platform_account_id=eq.tt-${encodeURIComponent(handle)}&platform=eq.tiktok&thumbnail_url=is.null&select=id,post_url`,
  );
  if (!posts.length) {
    console.log(`${handle}: no posts need thumbnails`);
    return;
  }

  const summary = { uploaded: 0, viaOembed: 0, failed: 0 };

  for (const post of posts) {
    const videoId = post.id.replace(/^tt-/, "");
    const coverUrl = covers.get(videoId);

    let bytes, contentType, viaOembed = false;
    try {
      if (!coverUrl) throw new Error("no captured cover url");
      ({ bytes, contentType } = await fetchBytes(coverUrl, { Referer: "https://www.tiktok.com/" }));
    } catch {
      try {
        const thumbUrl = await oembedThumbnail(post.post_url);
        ({ bytes, contentType } = await fetchBytes(thumbUrl));
        viaOembed = true;
      } catch (err) {
        console.error(`  ✗ ${post.id}: ${err.message}`);
        summary.failed++;
        await sleep(500);
        continue;
      }
    }

    try {
      const publicUrl = await uploadImage(`tiktok/${videoId}.jpg`, bytes, contentType);
      await rest(`posts?id=eq.${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ thumbnail_url: publicUrl }),
      });
      if (viaOembed) summary.viaOembed++;
      else summary.uploaded++;
    } catch (err) {
      console.error(`  ✗ ${post.id}: ${err.message}`);
      summary.failed++;
    }

    await sleep(500);
  }

  console.log(
    `${handle}: uploaded ${summary.uploaded}, via oEmbed fallback ${summary.viaOembed}, failed ${summary.failed}`,
  );
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
