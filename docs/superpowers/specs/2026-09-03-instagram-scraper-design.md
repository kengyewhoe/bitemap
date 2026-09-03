# Instagram scraper (manual, self-hosted) — design

**Date:** 2026-09-03
**Status:** approved direction; V1 in build

## Goal

Keep the BiteMap DB fresh with real Instagram data — creator avatars, new
posts, post thumbnails — via a **manually triggered, locally run** scraper.
No server/cron in V1. Scale later by adding handles (with a `type`) and,
eventually, hashtag/location sources.

## Why this shape

- IG has no official API for arbitrary public creators; logged-out scraping
  from a datacenter IP is blocked fast. Running **locally from the operator's
  machine** (residential IP + their own IG session cookie) sidesteps most
  blocking and keeps it a manual, low-volume operation.
- Supabase MCP here is read-only and CLI/service-key access is sandbox-gated,
  so writes go through a **local Node script using a dev service-role key**
  from a gitignored `.env.scraper` — the natural credential path for a local
  admin tool. This same script also creates the public Storage buckets.

## Pipeline (per handle)

```
handle → fetch web_profile_info (session cookie)
       → normalize(payload) → { creator, posts[] }
       → store: upload images to Storage, upsert creators + posts (idempotent)
```

### 1. fetch.mjs
`GET https://www.instagram.com/api/v1/users/web_profile_info/?username={h}`
Headers: `x-ig-app-id: 936619743392459`, `Cookie: sessionid=${IG_SESSIONID}`,
a browser `User-Agent`. Returns `data.user` with `profile_pic_url_hd` and
`edge_owner_to_timeline_media.edges[].node`. Per-handle try/catch; on 401/429
("require_login" / rate limit) stop early and tell the operator to refresh the
cookie. Polite delay between handles.

### 2. normalize.mjs (pure, unit-tested)
`normalize(payload) -> { creator, posts }`:
- `creator`: `{ id?, handle, display_name, bio, avatar_source_url }` from
  `username`, `full_name`, `biography`, `profile_pic_url_hd`.
- `posts[]`: from each timeline node → `{ shortcode, post_url, media_kind
  (image|video|carousel from is_video/__typename/product_type), content_summary
  (first caption edge text), thumbnail_source_url (display_url), posted_at (ISO
  from taken_at_timestamp), location_tag (location?.name) }`.
- No IO. This is the fragile parsing surface → tested against a saved real
  payload fixture in `normalize.test.mjs` (node:test).

### 3. store.mjs (idempotent)
`supabase-js` with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (dev):
- `ensureBucket('avatars')`, `ensureBucket('thumbnails')` — `createBucket(id,
  { public: true })`, ignore "already exists".
- For each image: fetch bytes from the signed IG CDN url → `upload(path,
  bytes, { upsert: true })` at `avatars/{creatorId}.jpg`,
  `thumbnails/{shortcode}.jpg` → public URL.
- Upsert `creators.avatar_url` + `avatar_source_url` + `avatar_fetched_at`.
- Upsert `posts` on conflict by `post_url` (unique per shortcode); set
  `thumbnail_url`, `ingest_status='ingested'`. Never duplicates on re-run.

### 4. run.mjs (orchestrator)
Reads handles from active `platform_accounts` (join `creators`) plus
`seed/handles.csv` (`handle,type,creator_id?`). Flags: `--handles a,b`,
`--dry-run` (fetch+normalize, print, no writes), `--avatars-only`. Prints a
summary: per handle added/updated/skipped, errors.

### 5. Skill `.claude/skills/instagram-scraper/`
Manual trigger + docs: how to set `.env.scraper` (IG_SESSIONID export steps,
dev service-role key), how to run (`node scripts/instagram/run.mjs`), how to add
handles/types, how to refresh an expired cookie. Extensible: `type` column today
carries `creator`/`venue`; hashtag/location sources are a future source module.

## Files
```
scripts/instagram/{fetch,normalize,store,run}.mjs
scripts/instagram/normalize.test.mjs
scripts/instagram/fixtures/web_profile_info.sample.json
seed/handles.csv                      # handle,type,creator_id
.env.scraper.example                  # documented; real one gitignored
.claude/skills/instagram-scraper/SKILL.md
```

## Non-goals (V1)
Scheduling/cron, hashtag & location feeds, prod DB, comment/like metrics,
media beyond a single thumbnail per post.

## Risks
- **Cookie expiry / blocking** — mitigated by local residential run + clear
  refresh guidance; not solved permanently (inherent to logged-out scraping).
- **Payload schema drift** — IG changes field shapes; the pure normalizer +
  fixture makes breakage a localized, testable failure.
- **ToS** — logged-out scraping violates IG ToS; operator-run, low-volume,
  personal-use posture. Documented in the skill.
