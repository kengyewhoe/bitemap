// Manual Instagram scraper. Run locally with credentials in .env.scraper:
//   node scripts/instagram/run.mjs [--handles a,b] [--dry-run] [--avatars-only]
//
// Reads active instagram platform_accounts (+ seed/handles.csv) unless
// --handles is given. Fetches each profile, normalizes, and upserts creators
// (avatars) and posts (+ thumbnails) into the DEV Supabase project. Idempotent.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchProfile, IgBlockedError } from "./fetch.mjs";
import { normalize } from "./normalize.mjs";
import { makeStore } from "./store.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

// --- tiny .env loader (KEY=VALUE lines) -----------------------------------
function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(join(repoRoot, ".env.scraper"));

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => {
  const i = args.indexOf(f);
  return i !== -1 ? args[i + 1] : null;
};
const DRY = has("--dry-run");
const AVATARS_ONLY = has("--avatars-only");
const handlesArg = val("--handles");

// --- config ----------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IG_SESSIONID = process.env.IG_SESSIONID;

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}
if (!IG_SESSIONID) die("IG_SESSIONID not set (see .env.scraper.example).");
if (!DRY && (!SUPABASE_URL || !SERVICE_KEY)) {
  die("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required for writes (or use --dry-run).");
}

const store = DRY ? null : makeStore({ url: SUPABASE_URL, serviceKey: SERVICE_KEY });

// --- handle list -----------------------------------------------------------
function handlesFromCsv() {
  const p = join(repoRoot, "seed", "handles.csv");
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").trim().split("\n").slice(1); // drop header
  return lines.map((l) => l.split(",")[0]?.trim()).filter(Boolean);
}

async function resolveHandles() {
  if (handlesArg) return handlesArg.split(",").map((s) => s.trim()).filter(Boolean);
  const csv = handlesFromCsv();
  if (DRY) return [...new Set(csv)];
  // Default: every onboarded instagram account, plus any csv extras.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/platform_accounts?platform=eq.instagram&select=handle`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) die(`list platform_accounts: HTTP ${res.status}`);
  const db = (await res.json()).map((r) => r.handle);
  return [...new Set([...db, ...csv])];
}

// --- post row builder ------------------------------------------------------
function postRow(p, account) {
  return {
    id: `ig-${p.shortcode}`,
    creator_id: account.creatorId,
    platform_account_id: account.platformAccountId,
    platform: "instagram",
    post_url: p.postUrl,
    media_kind: p.mediaKind, // reel | post
    content_summary: p.contentSummary,
    posted_at: p.postedAt,
    ingest_status: "needs_match", // scraped, awaiting place match
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- main ------------------------------------------------------------------
async function run() {
  const handles = await resolveHandles();
  if (!handles.length) die("No handles to scrape.");
  console.log(`\nScraping ${handles.length} handle(s)${DRY ? " [DRY RUN]" : ""}: ${handles.join(", ")}\n`);

  if (!DRY) {
    await store.ensureBucket("avatars");
    await store.ensureBucket("thumbnails");
  }

  const summary = { avatars: 0, postsNew: 0, postsRefreshed: 0, skipped: [], errors: [] };

  for (const handle of handles) {
    try {
      const payload = await fetchProfile(handle, { sessionId: IG_SESSIONID });
      const { profile, posts } = normalize(payload);

      if (DRY) {
        console.log(`@${handle}: avatar=${profile.avatarSourceUrl ? "yes" : "no"}, ${posts.length} posts`);
        for (const p of posts) console.log(`   • ${p.mediaKind} ${p.shortcode} — ${p.contentSummary?.slice(0, 40) ?? "(no caption)"}`);
        await sleep(1500);
        continue;
      }

      const account = await store.lookupAccount(handle);
      if (!account) {
        summary.skipped.push(`@${handle} (not onboarded — add to creators/platform_accounts first)`);
        continue;
      }

      // Avatar.
      if (profile.avatarSourceUrl) {
        const { url: avatarUrl } = await store.uploadImageOrSource("avatars", `${account.creatorId}.jpg`, profile.avatarSourceUrl);
        await store.updateCreatorAvatar(account.creatorId, avatarUrl, profile.avatarSourceUrl);
        summary.avatars++;
      }

      // Posts.
      if (!AVATARS_ONLY && posts.length) {
        const existing = await store.existingPostUrls(posts.map((p) => p.postUrl));
        const fresh = posts.filter((p) => !existing.has(p.postUrl));
        const seen = posts.filter((p) => existing.has(p.postUrl));

        // Upload thumbnails, then write rows.
        const rows = [];
        for (const p of fresh) {
          let thumb = null;
          if (p.thumbnailSourceUrl) {
            ({ url: thumb } = await store.uploadImageOrSource("thumbnails", `${p.shortcode}.jpg`, p.thumbnailSourceUrl));
          }
          rows.push({ ...postRow(p, account), thumbnail_url: thumb });
        }
        await store.insertPosts(rows);
        summary.postsNew += rows.length;

        for (const p of seen) {
          if (!p.thumbnailSourceUrl) continue;
          const { url: thumb } = await store.uploadImageOrSource("thumbnails", `${p.shortcode}.jpg`, p.thumbnailSourceUrl);
          await store.refreshPost(p.postUrl, { thumbnail_url: thumb, content_summary: p.contentSummary });
          summary.postsRefreshed++;
        }
      }

      console.log(`✓ @${handle}`);
      await sleep(3000 + Math.random() * 3000); // be polite
    } catch (err) {
      if (err instanceof IgBlockedError) {
        summary.errors.push(err.message);
        die(`Blocked by Instagram — stopping.\n  ${err.message}`);
      }
      summary.errors.push(`@${handle}: ${err.message}`);
      console.error(`✗ @${handle}: ${err.message}`);
    }
  }

  console.log("\n— Summary —");
  console.log(`avatars: ${summary.avatars}  posts new: ${summary.postsNew}  refreshed: ${summary.postsRefreshed}`);
  if (summary.skipped.length) console.log(`skipped:\n  ${summary.skipped.join("\n  ")}`);
  if (summary.errors.length) console.log(`errors:\n  ${summary.errors.join("\n  ")}`);
  console.log("");
}

run().catch((e) => die(e.stack || e.message));
