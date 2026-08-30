# BiteMap — Backend, Business Logic & Data Model Requirements

**Status:** Draft for MVP implementation  
**Audience:** Backend / API / data  
**Product source:** [`SPEC.md`](SPEC.md)  
**Frontend mapping:** [`frontend/BACKEND.md`](frontend/BACKEND.md)  
**Launch:** Kuala Lumpur metro · mobile web  
**Last updated:** 2026-08-30

This document is the implementation contract for the API, persistence, and domain rules. Where it conflicts with archived drafts, **this file + `SPEC.md` win**. Where the live UI and `SPEC.md` differ on *what is rated*, §3.1 wins (place-level Good/Bad for v1 screens).

---

## 1. Purpose

The backend exists to:

1. Authenticate users and authorize votes / follows / claims / saves.
2. Serve **nearby KL places** (map pins + list) ranked for “eat now.”
3. Serve **place detail** with influencer mentions (oEmbed + thumbnails — **no video files**).
4. Record **Good / Bad** (honor-system visit) and keep place + creator scores consistent.
5. Serve **creator profiles**, follow graph, and trust ranking.
6. Support **curated ingest** (manual first) that matches posts to Google Place IDs.

It does **not** exist to scrape at request time, host TikTok/IG binaries, or verify GPS check-ins.

---

## 2. System context

| Layer | Choice | Requirement |
|---|---|---|
| API | Node.js + NestJS | Versioned JSON REST (`/v1/...`). HTTPS only. |
| DB | PostgreSQL 15+ + PostGIS | All geospatial queries in-DB. UUID PKs. |
| Cache | Redis | Nearby geohash, oEmbed HTML, leaderboard, rate limits. |
| Auth | Email OTP and/or Google OAuth | JWT access (~15m) + refresh (~30d). |
| Maps / Places | Google Places (or Mapbox — pick one) | Place ID is venue source of truth. Budget-cap all calls. |
| Media | oEmbed + remote thumbnail URLs | **Zero video bytes on our origin / CDN / object storage.** |
| Ingest | Manual/curated jobs; optional later Python collectors | LLM extract **on ingest only**, results cached. |

**Clients:** `frontend/` mock today; production mobile web. Same API.

**Environments:** `dev` · `staging` · `prod`. Seed data required in all three so maps are never empty.

---

## 3. Locked domain decisions

| Topic | Rule |
|---|---|
| Geography | KL metro only. Reject or clamp queries outside the KL bounding box. Distances in **km**. |
| Default radius | **5 km**. Max allowed **10 km**. |
| Empty map | If &lt; 3 places in radius, fall back to **KL trending** (city-wide, still KL-only). Never return `[]` as the only home state. |
| Guest | May browse nearby + place + creators. **Must be signed in to vote, follow, save, claim.** |
| Visit proof | Honor system. Do **not** persist a “verified visit” flag. API copy/errors must not say verified. |
| Video | Store `post_url`, `thumbnail_url`, `oembed_html`. Never download or re-encode video. |
| Matching | Commit a place only with `provider_place_id` (or ops override). Never name-only. |
| Followers | May cache `follower_count`. **Never** use it for leaderboard or nearby rank. |
| Sharing | Not required. No OG image generation in MVP. |

### 3.1 What a rating is (v1 lock)

**UI / core flow (login → nearby → preview → rate):** a rating is **Good or Bad on a place**.

- Unique `(user_id, place_id)`.
- Default: **lock after submit** (`409` on second vote).
- Place meter: `good_pct = good_count / (good_count + bad_count)`.
- Creator trust: roll up from ratings on **places they have a mapped `post` for** (see §6.2).

`SPEC.md` described post-level Legit/Hype. That remains a **v2 option**. Schema keeps `post_id` **nullable** so we can add tip-level votes without a migration crisis.

**Labels in API:** `good` | `bad`. UI may say “Was it legit?” — persist `good`/`bad`.

---

## 4. Actors and authorization

| Role | Who | Can |
|---|---|---|
| `anon` | No token | Read places, posts, public creator profiles, nearby, leaderboard |
| `user` | Signed-in diner | All anon + vote, follow, save, submit claim, report |
| `creator` | User with `claim_status = verified` on a creator | All user + flag own posts `is_sponsored`, suggest place correction (ops still commits) |
| `ops` | Internal | Seed, match review, claim approve/reject, takedown embed, hide post/place |

**Creator cannot:** delete or alter community ratings; change `good_count` / credibility directly.

**Rate limits (v1):**

- Auth: 5 OTP requests / email / 15 min.
- Vote: 30 / user / hour.
- Nearby: 60 / IP / min (anon), 120 / user / min.
- Ingest endpoints: `ops` only.

---

## 5. Invariants (must hold)

1. A `places` row in `published` state has a unique `provider_place_id` and a point **inside the KL polygon**.
2. A `posts` row shown in API has `ingest_status = ready` and either `oembed_html` or `thumbnail_url` + `post_url`.
3. At most one `user_ratings` row per `(user_id, place_id)` where `post_id IS NULL` (v1 place votes).
4. `places.good_count + places.bad_count` equals the count of place-level ratings for that place.
5. `creators.legit_count` / `hype_count` are derived (job or trigger), not client-supplied.
6. No binary media owned by BiteMap except optional small avatars we host ourselves (not required for MVP — remote URLs OK).
7. Precise lat/lng from the browser is a **query parameter**, not a stored trail. Optional store: `last_coarse_geohash` (precision ≤ 5) + `last_city = KL`.

---

## 6. Business logic

### 6.1 Geography

**KL bounding box (v1, replace with official polygon when available):**

```
south: 2.90   north: 3.30
west:  101.50 east:  101.90
```

- `GET /places/nearby`: if request lat/lng outside box, ignore coords and use **KL centroid** `(3.1390, 101.6869)` plus city-wide trending.
- Always filter `ST_Within(location, kl_polygon)`.
- `distance_km` = `ST_DistanceSphere(place, user_point) / 1000`.
- Walk minutes: client-side or `round(distance_km / 0.08)` (≈ 12 min / km). Not a routing engine in MVP.

**Areas (labels, not geo filters unless ops maps them):** Chow Kit, Kampung Baru, Bukit Bintang, Bangsar, Cheras, Pudu, Chinatown, KLCC, TTDI, Brickfields, Jalan Alor, etc.

### 6.2 Scoring

#### Place `good_pct`

```
if good_count + bad_count == 0:
  good_pct = null   # UI shows “No ratings yet”
else:
  good_pct = round(100 * good_count / (good_count + bad_count))
```

#### Place `weighted_rank` (nearby / trending)

Compute at query time or refresh every 5–15 min per geohash:

```
recency_score = Σ for each ready post on place:
  exp(-age_days / HALF_LIFE_DAYS)

mention_score = count of ready posts with timestamp >= now() - 30 days

trust_boost = average(creator.display_credibility) of those posts
              (1.0 if no scored creators)

distance_decay = exp(-distance_km / 3.0)     # nearby only; = 1 for city trending

weighted_rank = mention_score * recency_score * trust_boost * distance_decay
```

**v1 constants (tunable, store in config, not magic in five files):**

| Constant | Value | Notes |
|---|---|---|
| `HALF_LIFE_DAYS` | `14` | Mentions older than ~30d barely count |
| `NEARBY_RADIUS_KM` | `5` | |
| `MIN_PLACES_BEFORE_FALLBACK` | `3` | Else KL trending |
| `CREATOR_VOTE_FLOOR` | `10` | Place-votes on their mentioned places |
| `TRUSTED_BADGE_FLOOR` | `25` | And `display_credibility >= 0.7` |
| `HIGH_TRUST_FILTER_MIN_CREATORS` | `15` | Hide UI filter until then |

**Heat bucket** (map pin color only):

| Heat | Condition |
|---|---|
| `high` (chili) | `weighted_rank` in top 20% of the result set **or** ≥ 3 posts in 7 days |
| `medium` (mango) | default |
| `low` (lime) | 1 mention, older than 14 days |

Heat is **relative to the current result set**, not a global stored enum (may cache on the DTO).

#### Creator `display_credibility`

```
community_ratio = legit_count / (legit_count + hype_count)   # if total > 0

if (legit_count + hype_count) >= CREATOR_VOTE_FLOOR:
  display_credibility = community_ratio
  use_seed = false
else:
  display_credibility = seed_credibility   # hand-set 0–1
  use_seed = true
```

**Roll-up job (after each rating, or async):**

- For each creator with a `posts.place_id = rated place`:
  - Count distinct users’ Good on that place as +legit, Bad as +hype  
  - **v1 simplification:** each place-vote counts once per creator who mentioned that place (not once per post).

Leaderboard sort: `display_credibility DESC`, tie-break `legit_count DESC`, then `updated_at`. **Not** followers.

### 6.3 Voting

1. User must be authenticated.
2. Place must be `published` and not `hidden`.
3. If a row exists for `(user_id, place_id)` → `409 VOTE_LOCKED`.
4. Insert `user_ratings` with `rating_type`, `place_id`, `post_id = null`, `creator_id = null` (or first mentioning creator — optional denorm).
5. Increment place counters in the **same transaction**.
6. Enqueue `recompute_creator_scores` for creators linked via posts.
7. Response includes new `good_pct` and `{ already_voted: true, my_vote }`.

Idempotency: `Idempotency-Key` header optional; unique constraint is the source of truth.

### 6.4 Mentions / posts

- A post is visible if `ingest_status = ready` and `place_id IS NOT NULL` and not `takedown`.
- Place page: posts ordered by `posted_at DESC`, cap 20, paginate.
- Preview: latest post’s `thumbnail_url` + `content_summary` or first 140 chars + handle.
- If oEmbed fetch fails at ingest: still `ready` if `thumbnail_url` + `post_url` exist. Client shows thumb + “Open original.”
- Takedown: set `takedown = true`, null out `oembed_html`. Keep URL if legally OK for ops audit.

### 6.5 Place matching (ingest)

1. Ops or job submits `post_url` + optional hinted name.
2. Fetch oEmbed (TikTok/IG official). Persist HTML + thumbnail URL. **Do not** save video bytes.
3. LLM (optional) proposes `{ name, area, confidence }` from caption — **does not write `place_id`.**
4. Lookup Places API; attach `provider_place_id` if confidence ≥ `0.85` **and** result inside KL.
5. Else `ingest_status = needs_match` for ops queue.
6. Duplicate `provider_place_id` → reuse existing `places` row.

### 6.6 Follow

- `PUT /me/following/:creatorId` upsert. `DELETE` removes.
- Skip onboarding = empty follows; nearby does **not** require follows (follows are a later personalization boost, optional v1.1: `trust_boost *= 1.15` if followed).
- **v1 nearby does not filter to followed-only** unless `?followed=1`.

### 6.7 Saves

- `list`: `want` | `been`. Default `want`.
- Unique `(user_id, place_id)`.
- Optional for v1; frontend already calls localStorage.

### 6.8 Claims

1. `POST /creators/:id/claims` with `proof_note` (URL or text). Status `pending`. Creator `claim_status → pending`.
2. Only one open pending claim per creator.
3. Ops `POST /ops/claims/:id/review` `{ decision: approved|rejected, note }`.
4. Approved: `claimed_by_user_id = user`, `claim_status = verified`.
5. User may only have one verified creator claim.

### 6.9 Reports

`POST /reports` `{ target_type, target_id, reason }`.  
Reasons: `wrong_place` | `closed` | `spam` | `not_food` | `impersonation` | `unlabeled_sponsored`.  
Ops triage. No public listing.

### 6.10 Auth

- `POST /v1/auth/otp/request` `{ email }` → send 6-digit or magic link (provider TBD).
- `POST /v1/auth/otp/verify` `{ email, code }` → `{ access_token, refresh_token, user }`.
- `GET /v1/auth/google` / callback.
- `POST /v1/auth/refresh` · `POST /v1/auth/logout` (revoke refresh family).
- Create `users` on first success. `role = user`, `last_city = KL`.

---

## 7. Data model

**Conventions:** UUID v4 PKs. `timestamptz` everywhere. Soft-delete via `deleted_at` where noted. All public reads exclude `deleted_at IS NOT NULL`.

### 7.1 ER overview

```
users 1──N user_ratings N──1 places
users 1──N follows N──1 creators
users 1──N saves N──1 places
users 1──1? creators          (via claimed_by_user_id)
creators 1──N platform_accounts
creators 1──N posts N──1 places
creators 1──N claim_requests N──1 users
posts 1──N user_ratings       (nullable, v2)
```

### 7.2 `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `email` | citext | UNIQUE, NULL | Null if Google-only until linked |
| `google_sub` | text | UNIQUE, NULL | |
| `display_name` | text | | Default from email prefix / Google |
| `avatar_url` | text | NULL | Remote URL |
| `role` | text | CHECK `user\|ops` | Default `user` |
| `last_city` | text | | Default `KL` |
| `last_coarse_geohash` | text | NULL | Precision ≤ 5 |
| `created_at` | timestamptz | NOT NULL | Vote-weight later |
| `updated_at` | timestamptz | NOT NULL | |

### 7.3 `creators`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Person, not a handle |
| `display_name` | text | NOT NULL | |
| `bio` | text | NULL | |
| `avatar_url` | text | NULL | |
| `cover_url` | text | NULL | |
| `niche_tags` | text[] | | e.g. `{mamak,street-food}` |
| `seed_credibility` | numeric(4,3) | 0–1 | Hand-score |
| `seed_score_notes` | text | NULL | Ops rationale |
| `legit_count` | int | ≥ 0 | Derived |
| `hype_count` | int | ≥ 0 | Derived |
| `credibility_score` | numeric(4,3) | NULL | Cached `display_credibility` |
| `use_seed` | bool | | Cached |
| `claim_status` | text | `unclaimed\|pending\|verified\|rejected` | |
| `claimed_by_user_id` | uuid | FK users, NULL, UNIQUE | One creator per user |
| `recommended` | bool | | Show in onboarding |
| `created_at` / `updated_at` | timestamptz | | |

### 7.4 `platform_accounts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `creator_id` | uuid | FK creators ON DELETE CASCADE | |
| `platform` | text | `tiktok\|instagram\|youtube\|other` | |
| `handle` | text | NOT NULL | With or without `@` — normalize lowercase, strip `@` |
| `external_id` | text | NULL | |
| `follower_count` | int | NULL | Cache only |
| `profile_url` | text | NULL | |
| UNIQUE | `(platform, handle)` | | |

### 7.5 `places`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `provider` | text | `google\|mapbox` | |
| `provider_place_id` | text | UNIQUE | Source of truth |
| `name` | text | NOT NULL | |
| `location` | geography(Point,4326) | NOT NULL | GiST index |
| `address` | text | NULL | |
| `area` | text | NULL | Neighborhood label |
| `category` | text | NULL | |
| `halal` | bool | NULL | Unknown ≠ false in filters (`IS TRUE`) |
| `price_level` | int | NULL 0–4 | From Places |
| `hours_json` | jsonb | NULL | Cached weekday hours |
| `hours_updated_at` | timestamptz | NULL | |
| `operational_status` | text | `operational\|closed_temporarily\|closed_permanently\|unknown` | |
| `blurb` | text | NULL | Editorial / LLM summary, cached |
| `status` | text | `draft\|published\|hidden` | API lists `published` only |
| `good_count` | int | ≥ 0 default 0 | |
| `bad_count` | int | ≥ 0 default 0 | |
| `total_mentions` | int | ≥ 0 | Denorm ready posts |
| `weighted_rank` | numeric | NULL | Optional cache |
| `created_at` / `updated_at` | timestamptz | | |

**Indexes:** GiST(`location`); `(status, operational_status)`; `area`.

### 7.6 `posts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `creator_id` | uuid | FK creators | |
| `platform_account_id` | uuid | FK platform_accounts | |
| `place_id` | uuid | FK places, NULL | Until matched |
| `platform` | text | | |
| `post_url` | text | UNIQUE | Canonical |
| `oembed_html` | text | NULL | Cached |
| `oembed_fetched_at` | timestamptz | NULL | |
| `thumbnail_url` | text | NULL | Remote |
| `content_summary` | text | NULL | Ingest LLM |
| `sentiment_score` | numeric | NULL | Ingest only |
| `quote` | text | NULL | Short pull-quote for cards |
| `is_sponsored` | bool | default false | |
| `posted_at` | timestamptz | NOT NULL | Original |
| `ingest_status` | text | `pending\|needs_match\|ready\|failed\|takedown` | |
| `takedown` | bool | default false | |
| `created_at` / `updated_at` | timestamptz | | |

**Indexes:** `(place_id, posted_at DESC)` where ready; `(creator_id, posted_at DESC)`.

### 7.7 `user_ratings`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `user_id` | uuid | FK users | |
| `place_id` | uuid | FK places | Required v1 |
| `post_id` | uuid | FK posts, NULL | v2 tip-level |
| `creator_id` | uuid | FK creators, NULL | Optional denorm |
| `rating_type` | text | `good\|bad` | |
| `created_at` | timestamptz | NOT NULL | |

**UNIQUE** `(user_id, place_id)` WHERE `post_id IS NULL`.  
**UNIQUE** `(user_id, post_id)` WHERE `post_id IS NOT NULL` (future).

### 7.8 `follows`

| Column | Type | Constraints |
|---|---|---|
| `user_id` | uuid | PK part, FK users |
| `creator_id` | uuid | PK part, FK creators |
| `created_at` | timestamptz | |

### 7.9 `saves`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | uuid | PK part | |
| `place_id` | uuid | PK part | |
| `list` | text | `want\|been` | Default `want` |
| `created_at` | timestamptz | | |

### 7.10 `claim_requests`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `creator_id` | uuid | FK | |
| `user_id` | uuid | FK | |
| `proof_note` | text | NOT NULL | |
| `status` | text | `pending\|approved\|rejected` | |
| `reviewed_by` | uuid | FK users, NULL | |
| `reviewed_at` | timestamptz | NULL | |
| `review_note` | text | NULL | |

Partial unique: one `pending` row per `creator_id`.

### 7.11 `reports`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK |
| `target_type` | text | `place\|post\|creator` |
| `target_id` | uuid | |
| `reason` | text | enum above |
| `status` | text | `open\|actioned\|dismissed` |
| `created_at` | timestamptz | |

### 7.12 `ingest_jobs`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `kind` | text | `oembed\|places_refresh\|llm_extract` |
| `payload` | jsonb | url / handle / place_id |
| `status` | text | `queued\|running\|ok\|error` |
| `last_error` | text | |
| `created_at` / `finished_at` | timestamptz | |

### 7.13 Config / reference

`app_config` key-value for half-life, floors, KL polygon WKT.  
Optional `rank_snapshots (id, kind, payload jsonb, created_at)` for weekly leaderboard debug.

---

## 8. API requirements

Base: `/v1`. JSON. Errors:

```json
{ "error": { "code": "VOTE_LOCKED", "message": "You already rated this place." } }
```

| HTTP | When |
|---|---|
| 400 | Validation |
| 401 | Missing/invalid token |
| 403 | Authenticated but not allowed |
| 404 | Unknown id or not published |
| 409 | Vote locked, duplicate claim |
| 429 | Rate limit |

### 8.1 Auth & me

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/auth/otp/request` | no | `{ email }` | `{ ok: true }` |
| POST | `/auth/otp/verify` | no | `{ email, code }` | tokens + user |
| GET | `/auth/google` | no | | redirect |
| POST | `/auth/refresh` | refresh | `{ refresh_token }` | tokens |
| POST | `/auth/logout` | yes | | `{ ok: true }` |
| GET | `/me` | yes | | user + `role` |
| PATCH | `/me` | yes | `{ display_name?, last_coarse_geohash? }` | user |
| GET | `/me/stats` | yes | | `{ ratings_count, saves_count, following_count }` |

### 8.2 Places

| Method | Path | Auth | Query / body | Response highlights |
|---|---|---|---|---|
| GET | `/places/nearby` | no | `lat, lng, radius_km=5, q, halal, sort=rank\|distance\|recent, followed=0, cursor` | `{ items[], fallback: "radius"\|"kl_trending", next_cursor }` |
| GET | `/places/:id` | no | | place DTO + `good_pct`, `my_vote` if authed |
| GET | `/places/:id/preview` | no | | compact card DTO |
| GET | `/places/:id/posts` | no | `cursor, hide_sponsored` | posts DTO |
| POST | `/places/:id/ratings` | **yes** | `{ type: "good"\|"bad" }` | `{ good_pct, my_vote }` |
| GET | `/places/:id/ratings/me` | yes | | `{ type }` or 404 |
| PUT | `/me/saves/:placeId` | yes | `{ list?: "want"\|"been" }` | |
| DELETE | `/me/saves/:placeId` | yes | | |

**Nearby item DTO:**

```
id, name, lat, lng, area, category, halal, distance_km,
good_pct, good_count, bad_count, heat, mention, thumbnail_url
mention: { handle, quote, creator_id } | null
```

**Place DTO:** nearby fields + `address, hours, price_level, blurb, operational_status, provider_place_id` (for Maps URL).

**Post DTO:** `id, platform, post_url, thumbnail_url, oembed_html, quote, posted_at, is_sponsored, creator { id, handle, avatar_url, display_credibility }`.

### 8.3 Creators

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/creators` | no | `q, recommended, cursor` |
| GET | `/creators/leaderboard` | no | KL, trust order, `limit=50` |
| GET | `/creators/:id` | no | + `following` if authed |
| GET | `/creators/:id/places` | no | Distinct places via posts |
| PUT | `/me/following/:creatorId` | yes | |
| DELETE | `/me/following/:creatorId` | yes | |
| POST | `/creators/:id/claims` | yes | `{ proof_note }` |

### 8.4 Ops (role `ops`)

| Method | Path | Notes |
|---|---|---|
| POST | `/ops/ingest/posts` | `{ post_url, creator_id?, place_id? }` |
| GET | `/ops/ingest/queue` | `needs_match` |
| POST | `/ops/places/match` | `{ post_id, provider_place_id }` |
| POST | `/ops/claims/:id/review` | `{ decision, note }` |
| POST | `/ops/posts/:id/takedown` | |
| PATCH | `/ops/creators/:id` | seed scores, recommended flag |

### 8.5 Reports

`POST /reports` auth required.

---

## 9. Jobs

| Job | Trigger | Work |
|---|---|---|
| `oembed_refresh` | Daily + on ingest | Re-fetch oEmbed; on fail keep last HTML or clear + leave thumb |
| `places_hours_refresh` | Daily | Places Details for published rows; budget cap |
| `recompute_place_mentions` | On post ready / takedown | `total_mentions` |
| `recompute_creator_scores` | On rating / enqueue | legit/hype + credibility |
| `nearby_cache_warm` | Every 10 min | Redis `nearby:{geohash5}` for KL cells |
| `leaderboard_cache` | Every 10 min | Redis `leaderboard:kl` |

Failed jobs: retry 3×, then `ingest_jobs.status = error`. No user-facing 500 from a stale cache — fall through to SQL.

---

## 10. Privacy, legal, abuse

- Do not log raw GPS beyond request logs TTL (≤ 7 days). Prefer geohash in analytics.
- oEmbed HTML is third-party; sanitize (allowlist iframe hosts: TikTok, Instagram, YouTube).
- Takedown SLA: ops can hide a post without deploy.
- Right of publicity: `claim_status` + report `impersonation`; hide creator from leaderboard if `rejected` after claim dispute (ops flag `hidden`).
- Rate-limit + unique vote is the v1 anti-farm. Store `users.created_at` for a later weight of `min(1, age_days / 7)`.

---

## 11. Non-functional

| Requirement | Target |
|---|---|
| Nearby p95 | &lt; 200 ms from cache; &lt; 500 ms cold SQL |
| Place detail p95 | &lt; 300 ms |
| Availability | Best-effort MVP; no multi-region |
| Pagination | Cursor (`posted_at, id`), page size 20 default, max 50 |
| Idempotent writes | Votes, follows, saves |
| Observability | Request id, match-queue depth, vote 409 rate, oEmbed fail rate |

---

## 12. Seed (launch blocker)

Before any prod deploy of nearby:

- **80–150** `places` published inside KL with real `provider_place_id`.
- **30–50** `creators` with `seed_credibility` and `seed_score_notes`.
- ≥ 1 `ready` post per launch place.
- ≥ 10 `recommended` creators for follow onboarding.

Without this, do not ship the map.

---

## 13. Implementation order

1. Schema + KL polygon + seed script.  
2. Auth + `/me`.  
3. Read APIs: nearby, place, posts (oEmbed already in seed).  
4. Ratings + counters + creator roll-up.  
5. Follow + creator + leaderboard.  
6. Saves, claims, reports, ops ingest.  
7. Redis, hours refresh, oEmbed refresh.

---

## 14. Open items (backend)

- [ ] OTP vs magic-link vs Google-only for v1.  
- [ ] Google vs Mapbox + monthly cap.  
- [ ] Official KL polygon vs bbox in §6.1.  
- [ ] Whether `followed=1` personalization ships in v1 (schema ready).  
- [ ] Recency half-life tune after first week of data.  
- [ ] Promote post-level ratings (`post_id`) — schema ready, APIs not.

---

## 15. Relationship to other docs

| Doc | Role |
|---|---|
| `SPEC.md` | Product / UX / stack |
| `design.md` | Visual tokens (not API) |
| `frontend/BACKEND.md` | Screen → route cheat sheet |
| **This file** | Normative backend + model + rules |
