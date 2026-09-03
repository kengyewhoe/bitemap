---
name: instagram-scraper
description: Manually scrape Instagram profiles to refresh BiteMap's DB — creator avatars, new posts, and post thumbnails. Use for "scrape instagram", "refresh creator avatars", "pull new posts", "update the map from IG", or when adding new handles to track. Local, operator-run against the DEV Supabase project.
---

# Instagram scraper (manual)

Self-hosted, logged-out scraper. Fetches IG `web_profile_info` for each handle,
normalizes, and upserts into DEV Supabase: creator avatars + `avatar_source_url`,
new `posts` (status `needs_match`), and re-hosted thumbnails in Storage.
Idempotent — safe to re-run; existing posts keep their human-set
`ingest_status`/`place_id`.

Design: `docs/superpowers/specs/2026-09-03-instagram-scraper-design.md`.

## One-time setup

1. `cp .env.scraper.example .env.scraper` (gitignored) and fill:
   - `IG_SESSIONID` — from a logged-in Chrome: DevTools → Application → Cookies →
     `instagram.com` → copy the `sessionid` value.
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → DEV project → Project
     Settings → API → `service_role`. Secret; never commit or ship to the browser.
   - `SUPABASE_URL` is prefilled to the DEV project.
2. Requires Node 18+ (global `fetch`). No `npm install` — the scraper is dependency-free.

## Run

```bash
# Every onboarded instagram handle (platform_accounts) + seed/handles.csv:
node scripts/instagram/run.mjs

# Specific handles:
node scripts/instagram/run.mjs --handles mingchuun,jajabinxz

# Preview without writing (fetch + parse only; still needs IG_SESSIONID):
node scripts/instagram/run.mjs --dry-run

# Avatars only, skip posts:
node scripts/instagram/run.mjs --avatars-only
```

Prints a per-run summary: avatars updated, new posts, refreshed posts, skipped,
errors.

## Add / scale handles

- **Existing creator, new IG account:** ensure a row in `creators` +
  `platform_accounts` (platform `instagram`, the `handle`). The default run picks
  it up automatically.
- **New handles to track:** add rows to `seed/handles.csv`
  (`handle,type,creator_id`). `type` is for your own bookkeeping now
  (`creator`, `venue`, …) and is the seam for future source types. A handle with
  no matching `platform_accounts` row is reported as **skipped (not onboarded)** —
  create the creator/account first (V1 does not auto-create creators).

## Refresh an expired cookie

If a run stops with **"IG requires login" / "require login"**, your
`IG_SESSIONID` expired or IG is rate-limiting. Re-copy `sessionid` from Chrome
into `.env.scraper`; if it persists, wait and run fewer handles at a time.

## Files

- `scripts/instagram/fetch.mjs` — IG HTTP fetch (cookie, app-id, block detection)
- `scripts/instagram/normalize.mjs` — pure payload → rows (+ `normalize.test.mjs`)
- `scripts/instagram/store.mjs` — Supabase REST/Storage writes (service key)
- `scripts/instagram/run.mjs` — orchestrator (handles, flags, summary)

Test the parser after any IG payload change:
`node --test scripts/instagram/normalize.test.mjs`

## Notes

- Logged-out scraping is against IG ToS; keep it operator-run and low-volume.
- V1 is manual only. Scheduling (edge function + cron) and hashtag/location
  sources are deliberately out of scope — see the spec's non-goals.
