// Fetch TikTok's auto-generated (ASR) transcripts for harvested videos. The
// WebVTT URLs in the raw items are signed and expire within days of the harvest,
// so run this right after harvest.mjs.
//
//   node scripts/tiktok/transcripts.mjs <handle>
// Output: .captured/<handle>.transcripts.json  { "<video id>": "plain text", ... }
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const handle = process.argv[2];
if (!handle) {
  console.error("usage: transcripts.mjs <handle>");
  process.exit(1);
}
const dir = join(dirname(fileURLToPath(import.meta.url)), ".captured");
const outPath = join(dir, `${handle}.transcripts.json`);
const out = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
const raw = JSON.parse(readFileSync(join(dir, `${handle}.raw.json`), "utf8"));

// Prefer the video's original-language caption, then English, then anything.
function pickUrl(item) {
  const cla = item.video?.claInfo?.captionInfos ?? [];
  const orig = cla.find((c) => c.isOriginalCaption) ?? cla.find((c) => c.languageCode === "en") ?? cla[0];
  if (orig?.url) return orig.url;
  const subs = item.video?.subtitleInfos ?? [];
  return (subs.find((s) => s.LanguageCodeName?.startsWith("eng")) ?? subs[0])?.Url ?? null;
}

const vttToText = (vtt) =>
  vtt
    .split("\n")
    .filter((l) => l && l !== "WEBVTT" && !l.includes("-->") && !/^\d+$/.test(l.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

let fetched = 0, failed = 0;
for (const item of raw) {
  if (out[item.id]) continue;
  const url = pickUrl(item);
  if (!url) continue;
  const res = await fetch(url, { headers: { Referer: "https://www.tiktok.com/" } }).catch(() => null);
  if (res?.ok) {
    out[item.id] = vttToText(await res.text());
    fetched++;
  } else failed++;
  await new Promise((r) => setTimeout(r, 1000));
}
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`${handle}: ${fetched} transcripts fetched, ${failed} failed, ${Object.keys(out).length} total`);
