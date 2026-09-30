#!/usr/bin/env node
// Operator-run TikTok harvest for one creator. Opens a visible Chrome window,
// lets the page load its own video list, and records the JSON responses it
// fetches. No request signing, no CAPTCHA handling: if TikTok shows a login
// wall or CAPTCHA, the operator clears it by hand and the script waits.
//
//   PLAYWRIGHT_DIR=/dir/with/node_modules node scripts/tiktok/harvest.mjs <handle> [max=50]
//
// Session (cookies) persists in ~/.bitemap-tiktok-profile, outside the repo.
// Output: scripts/tiktok/.captured/<handle>.json (clean rows) and
//         scripts/tiktok/.captured/<handle>.raw.json (raw items, for field discovery).

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [handle, maxArg] = process.argv.slice(2);
if (!handle) {
  console.error("usage: harvest.mjs <handle> [max=50]");
  process.exit(1);
}
const MAX = Number(maxArg ?? 50);

const { chromium } = process.env.PLAYWRIGHT_DIR
  ? createRequire(join(process.env.PLAYWRIGHT_DIR, "noop.js"))("playwright")
  : await import("playwright");

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), ".captured");
const PROFILE_DIR = join(homedir(), ".bitemap-tiktok-profile");
const HUMAN_GATE =
  '#captcha-verify-container, .captcha-verify-container, iframe[src*="captcha"], [class*="captcha"]';

const items = new Map(); // video id -> raw item

// A TikTok video item: 19-digit id, a caption field, and a creation time.
function collect(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 40) return;
  if (Array.isArray(node)) {
    for (const x of node) collect(x, depth + 1);
    return;
  }
  // Profile pages also load For You recommendations; keep only this creator's videos.
  const author = node.author?.uniqueId ?? node.author;
  if (typeof node.id === "string" && /^\d{15,}$/.test(node.id) && "desc" in node && node.createTime && author === handle) {
    items.set(node.id, node);
  }
  for (const k in node) collect(node[k], depth + 1);
}

function toRow(it) {
  const poi = it.poi ?? it.poiInfo ?? null;
  return {
    id: it.id,
    url: `https://www.tiktok.com/@${handle}/video/${it.id}`,
    createTime: Number(it.createTime),
    desc: it.desc ?? "",
    cover: it.video?.cover ?? it.video?.originCover ?? null,
    poi: poi
      ? {
          id: poi.id ?? poi.poiId ?? null,
          name: poi.name ?? poi.poiName ?? null,
          address: poi.address ?? poi.poiAddress ?? null,
          city: poi.city ?? poi.cityName ?? null,
        }
      : null,
    plays: it.stats?.playCount ?? it.statsV2?.playCount ?? null,
  };
}

async function waitForHuman(page) {
  if (!(await page.locator(HUMAN_GATE).first().isVisible().catch(() => false))) return;
  console.log("WAITING_FOR_HUMAN: clear the CAPTCHA in the Chrome window.");
  while (await page.locator(HUMAN_GATE).first().isVisible().catch(() => false)) {
    await page.waitForTimeout(2000);
  }
  console.log("Human gate cleared, continuing.");
}

// CDP_URL attaches to a Chrome the operator started and logged into (see
// README in this folder); otherwise Playwright launches its own window.
const browser = process.env.CDP_URL ? await chromium.connectOverCDP(process.env.CDP_URL) : null;
const ctx = browser
  ? browser.contexts()[0]
  : await chromium
      .launchPersistentContext(PROFILE_DIR, { headless: false, channel: "chrome", viewport: null })
      .catch(() => chromium.launchPersistentContext(PROFILE_DIR, { headless: false, viewport: null }));
const page = await ctx.newPage();

page.on("response", async (res) => {
  if (!res.url().includes("/api/")) return;
  if (!(res.headers()["content-type"] ?? "").includes("json")) return;
  try {
    collect(await res.json());
  } catch {}
});

// TikTok sometimes answers a profile with an error status (throttled or
// logged-out). Give the operator time to log in in the window, then retry.
for (let attempt = 1; ; attempt++) {
  const ok = await page
    .goto(`https://www.tiktok.com/@${handle}`, { waitUntil: "domcontentloaded" })
    .then((res) => {
      console.log(`profile status: ${res?.status()}`);
      return true;
    })
    .catch((e) => {
      console.log(`profile load failed: ${e.message.split("\n")[0]}`);
      return false;
    });
  if (ok) break;
  if (attempt === 3) {
    await ctx.close();
    process.exit(1);
  }
  console.log("WAITING_FOR_HUMAN: log in to TikTok in the Chrome window; retrying in 60s.");
  await page.waitForTimeout(60000);
}
await page.waitForTimeout(4000);
await waitForHuman(page);

// First batch is often embedded in the page rather than fetched.
const embedded = await page
  .locator("script#__UNIVERSAL_DATA_FOR_REHYDRATION__")
  .textContent({ timeout: 5000 })
  .catch(() => null);
if (embedded) {
  try {
    collect(JSON.parse(embedded));
  } catch {}
}

let stale = 0;
while (items.size < MAX && stale < 8) {
  const before = items.size;
  // Jump to the bottom so the grid's "load more" sentinel comes into view.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(3000);
  await waitForHuman(page);
  stale = items.size === before ? stale + 1 : 0;
  console.log(`items: ${items.size}`);
}

const raw = [...items.values()].sort((a, b) => b.createTime - a.createTime).slice(0, MAX);
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, `${handle}.raw.json`), JSON.stringify(raw, null, 2));
writeFileSync(join(OUT_DIR, `${handle}.json`), JSON.stringify(raw.map(toRow), null, 2));

const withPoi = raw.map(toRow).filter((r) => r.poi?.name).length;
console.log(`DONE ${handle}: ${raw.length} videos, ${withPoi} with a location tag -> ${OUT_DIR}`);
await ctx.close();
