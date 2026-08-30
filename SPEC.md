# BiteMap — Product & Technical Specification

> **Status:** Draft for MVP build  
> **Launch:** Kuala Lumpur metro · mobile web (PWA-first)  
> **Sources:** [`archive/SPEC.md`](archive/SPEC.md) (original technical outline) + [`archive/Ryan_draft.md`](archive/Ryan_draft.md) (locked product decisions, 2026-08-30)  
> **One-liner:** Right-now KL food map + community ranker for food influencers. Viral clips → real places → Legit vs Hype.  
> **Governance (30/08/2026):** SPEC.md is the product spec; the MVP build scope is **§8**, as amended by the **"MVP cut (agreed 30/08/2026)"** subsection at its top. [`SPEC_V1.md`](SPEC_V1.md) is retained as research input — its domain learnings (halal enum, creator taxonomy, media provenance) are folded into [`BACKEND_REQUIREMENTS.md`](BACKEND_REQUIREMENTS.md); its scope and naming do not govern.

---

## 1. Product vision

BiteMap centralizes fragmented social food reviews and turns them into **actionable “where should I eat right now” decisions** in KL, with a **community trust layer on creators**.

1. **Map** influencer recommendations to physical places (Google Place ID as source of truth).
2. **Aggregate** posts into one restaurant profile (embeds, not hosted video).
3. **Rank influencers** via community **Legit / Hype** stamps on tips.

**Problem:** A user sees a food video, cannot tell if the place is genuinely good or paid hype, and cannot easily find it (or similar) nearby.

**Positioning:** “What’s actually good near you tonight — and which KL food accounts you can trust.”

**Not:** Yelp, Google reviews, a TikTok clone, or a social network.

---

## 2. Locked product decisions

| Decision | Call |
|---|---|
| Session 1 job | **Right now.** Location → nearby trending → place + clips → go. Not weekend planning. |
| Core appeal | **Influencer ranker** (community trust), not a sharing/social graph. |
| Share unit (later) | Place + influencer + verdict. Not required for MVP. |
| Cold start | **Seed KL inventory** and **hand-score** a starter set of creators. No empty graph. |
| Geography | **KL city metro only.** |
| Influencers | **Inventory and users.** They can claim a profile. **Verification is manual.** |
| Video | **oEmbed / official embeds only.** Thumbnails + link. **Do not host full videos.** |
| Visit proof | **Honor system** (“I went”). No geo check-in required to vote. |
| Voting | **One vote per user per post.** Auth required. Default: **lock after submit.** |
| Launch surface | **Mobile web**, KL-focused. Not React Native for MVP. |

---

## 3. Who it’s for

| Role | Job |
|---|---|
| Primary | Someone in KL deciding dinner in the next ~20 minutes |
| Secondary | People who follow KL food accounts and want a **trust ranking** before they queue |
| Creators | KL food influencers who want a public trust profile they can claim |

**Out of scope for MVP:** tourists as a separate persona, group planning, multi-city, restaurant admin dashboards.

---

## 4. Goals and non-goals

### Goals (MVP)

- **Trending nearby** from recent influencer mentions (default **5 km**, KL only).
- Place page with the **clips that made it trend** (oEmbed + summary).
- Signed-in users stamp a post **Legit** or **Hype** (honor-system visit).
- **Credibility score** per influencer + **KL leaderboard** (trust, not followers).
- Influencers **request a claim**; ops **approves manually**.

### Non-goals (MVP)

- Share cards, Stories, referral loops, following graph.
- Scrapers as the only supply; hosting TikTok/IG files.
- Automatic visit verification / geofence as a vote gate.
- Dietary/price as rank drivers; paid restaurant placement; auto-verified badges.
- Native iOS/Android apps.

---

## 5. Success metrics

**North star:** Sessions that end in a **place view** or **Directions tap**.

**Secondary:** Nearby feed shows ≥3 places; votes/week (unique user × post); leaderboard visits; claim requests / approvals.

**Guardrails:** Wrong-place match rate; vote farming; **no full video downloads from our origin**.

Do not optimize for “posts ingested.”

---

## 6. User experience

### 6.1 Quick-start (session 1 — default)

| Step | Screen | Action | Outcome |
|---|---|---|---|
| 1 | Onboarding | Grant location, or **Browse Kuala Lumpur** | Coarse location or KL centroid. One screen, no carousel. |
| 2 | Map (home) | App loads **Trending Nearby** | Night map + tray; places ranked by recent mentions within ~5 km, recency-weighted |
| 3 | Map → place | Tap a restaurant | Profile: oEmbeds that drove the trend, thumbnail URLs, Legit vs Hype meter |
| 4 | Place | Directions (system maps) or Save (optional) | User can go now |

### 6.2 Detailed discovery

| Step | Screen | Action | Outcome |
|---|---|---|---|
| 1 | Restaurant profile | Open a place | Aggregated mentions, embed players, photos as **thumbnail URLs only**, Legit vs Hype meter (from post votes) |
| 2 | Restaurant profile | “High-trust creators only” | Filter to creators above a threshold. **Hide this chip until enough scored creators exist** (recommend ≥15). |
| 3 | Restaurant profile | “Hide sponsored” | Hides posts tagged sponsored |

### 6.3 Influencer evaluation (core loop)

| Step | Screen | Action | Outcome |
|---|---|---|---|
| 1 | Influencer profile | Open a creator | History of recommendations + running score. Claimed vs unclaimed is obvious. |
| 2 | Post | User eats, returns, stamps **Legit** or **Hype** | Honor “I went.” Copy must **not** say “verified visit.” |
| 3 | System | Vote recorded | Unique `(user_id, post_id)`. Updates `legit_count` / `hype_count` / `credibility_score`. |
| 4 | Rank / leaderboard | Browse KL ranking | Creators ranked by **community trust**, not follower count |

### 6.4 Claim flow

| Step | Screen | Action | Outcome |
|---|---|---|---|
| 1 | Unclaimed profile | **Claim** | Form: handles + proof (bio link or screenshot) |
| 2 | Ops queue | Manual approve / reject | `pending` → `verified` \| `rejected` |
| 3 | Claimed profile | Creator may flag sponsored, suggest place corrections | Ops confirms corrections. Creator **cannot** delete community votes. |

---

## 7. Information architecture (mobile web)

**Tabs**

1. **Map** — default home (session 1)
2. **Rank** (or “Creators”) — leaderboard + search — first-class; this is the brand
3. **Saved** — optional MVP; cut if needed
4. **Me** — votes, claim entry, city = KL

Restaurant and post/clip are **pages or sheets**, not tabs.

---

## 8. MVP scope

### MVP cut (agreed 30/08/2026)

Owner decision, narrowing this section for the first build. Where it conflicts with the rest of §8 (or with §12), this subsection wins.

**IN**

| Area | Requirement |
|---|---|
| Auth | Google sign-in (Supabase Auth). No email OTP. |
| Location | Device location, or KL fallback. |
| Nearby + list | `GET /places/nearby` feeds both the map home pins and the list. |
| Place detail | `GET /places/:id` + `GET /places/:id/posts` — IG embeds, tap-to-load. |
| Rating | `POST /places/:id/ratings` — Good/Bad on a **place**, one per user per place, lock after submit (second vote → `409`). |
| Account | `GET /me`. |

**OUT (deferred, not deleted)**

- Follows, leaderboard, influencer profile screens (`influencer.html`, `influencers.html`, `follow.html` parked, not removed).
- Claims, reports, server-side saves (stays localStorage).
- Credibility scoring — UI shows mention counts instead.
- Email OTP auth, Redis, background jobs, oEmbed refresh pipeline, PostGIS, NestJS, LLM calls.
- Ops endpoints / admin UI — seeding is via Supabase table editor.

**Stack for MVP:** Supabase (Postgres, Auth Google provider, Storage) + Next.js route handlers, on Vercel. Plain `lat`/`lng` doubles + haversine in SQL (hundreds of rows) — PostGIS deferred. **§12's stack table is superseded by this subsection for MVP.**

---

### In

| Area | Requirement |
|---|---|
| Geo | KL metro bounding box / area allowlist. Nearby = **5 km**. |
| Feed | Recent mentions; recency decay (prefer last **14–30 days**). |
| Place page | Name, area, category, mention count, meter, posts via **oEmbed**. |
| Post | Platform, URL, embed, summary, place, influencer, sponsored flag. |
| Voting | Auth required. Honor “I went.” **One vote per user per post.** Default lock after submit. |
| Credibility | `legit / (legit + hype)` + **minimum vote floor**. Hand-seed launch set. |
| Leaderboard | KL, trust-based, show vote volume. |
| Claim | Request + manual verify. |
| Ingest | **Curated / manual + light collectors.** LLM extract **on ingest only**, cached. Match to **Google Place ID**. |
| Media | Thumbnail URL + oEmbed HTML. **Zero video bytes on our CDN.** |

### Out / later

- Share cards, OG images, Stories.
- Geo visit proof; vote weight by account age (design now, enforce if abused).
- Auto claim, multi-city, native apps.
- Following, comments, DMs.
- Heavy scrapers as primary supply.

### Launch inventory (cold start)

- **~80–150 places**, **~30–50 creators**, each with ≥1 mapped post.
- Hand-score creators so the leaderboard is not empty.
- Thin GPS: show **KL trending**, never a blank map.

---

## 9. Trust, spam, sponsored

**Rubric (show once in UI)**

- **Legit:** Matched the clip; worth the trip/queue.
- **Hype:** Camera bait, bait-and-switch, not worth queue/price, or nothing like the video.
- Stamp scores the **tip/post** (and thus the creator), not a 1–5 restaurant review.

**Rules**

- One vote per `(user_id, post_id)`.
- Store `account_created_at` for later down-weighting.
- Sponsored: **manual + creator claim + user report**.
- Reports: wrong place, closed, spam, not food, impersonation.

---

## 10. Data, matching, legal

- Venue source of truth: **Google Place ID**. LLM **proposes**; human or high-confidence match **commits**. Never match on name alone (food courts, stalls, duplicate names).
- Closed/moved: Places operational status; dim “might be closed.”
- Identity: `creator_id` (person) vs `platform_account` (handle).
- **oEmbed** for TikTok/IG. If embed fails: **thumbnail + open original**.
- **No ripping or storing full videos.** Takedown = drop embed; keep metadata if legal.
- Claim/remove for names/faces on rank pages.
- Location: coarse for feed; no high-precision tracks. Guest can browse KL; **account required to vote.**

---

## 11. Data model

**Relationships:** `creators` 1—N `platform_accounts`; `creators` 1—N `posts` N—1 `places`; `user_ratings` N—1 `posts`; unique `(user_id, post_id)` on ratings.

### `users`

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `auth` | — | Provider ids as needed |
| `display_name` | string | |
| `created_at` | datetime | For later vote weighting |
| `last_city` | string | `KL` |
| `role` | enum | `user` \| `ops` |

### `creators`

| Field | Type | Notes |
|---|---|---|
| `id` | PK | Person-level identity (replaces flat `influencers`) |
| `name` | string | Display name |
| `niche_tags` | string[] | e.g. `["mamak", "budget-eats"]` |
| `credibility_score` | float | Derived; seed until vote floor |
| `legit_count` | int | |
| `hype_count` | int | |
| `claim_status` | enum | `unclaimed` \| `pending` \| `verified` \| `rejected` |
| `claimed_by_user_id` | FK → `users` | Nullable |
| `seed_score_notes` | text | Hand-score rationale |

### `platform_accounts`

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `creator_id` | FK → `creators` | |
| `platform` | enum | `tiktok` \| `instagram` \| … |
| `handle` | string | |
| `external_id` | string | Nullable |
| `follower_count` | int | Optional snapshot; **not** used for leaderboard |

### `places`

| Field | Type | Notes |
|---|---|---|
| `id` | PK | Replaces `restaurants` |
| `provider_place_id` | string | Google Place ID (or equivalent) |
| `name` | string | |
| `location` | geography(Point) | PostGIS |
| `address` | string | |
| `area` | string | e.g. Bangsar, Cheras, Jalan Alor |
| `category` | string | Cuisine / type |
| `operational_status` | string | From Places |
| `total_mentions` | int | Denormalized |
| `weighted_rank` | float | Mentions × recency × creator credibility × distance × anti-spam |

### `posts`

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `creator_id` | FK → `creators` | |
| `platform_account_id` | FK → `platform_accounts` | |
| `platform` | enum | |
| `post_url` | string | Canonical source |
| `embed_html` / `oembed_cache` | text | Cached oEmbed |
| `thumbnail_url` | string | No video files on our storage |
| `content_summary` | text | LLM on ingest, cached |
| `sentiment_score` | float | LLM on ingest, cached |
| `place_id` | FK → `places` | Nullable until matched |
| `timestamp` | datetime | Original post time |
| `is_sponsored` | bool | Manual / claim / report |
| `ingest_status` | string | |

### `user_ratings`

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `user_id` | FK → `users` | |
| `creator_id` | FK → `creators` | Denormalized for leaderboard |
| `post_id` | FK → `posts` | Unique with `user_id` |
| `rating_type` | enum | `legit` \| `hype` |
| `timestamp` | datetime | |

### `claim_requests`

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `creator_id` | FK | |
| `user_id` | FK | |
| `proof_note` | text | |
| `status` | enum | `pending` \| `approved` \| `rejected` |
| `reviewed_by` | FK | Nullable |
| `reviewed_at` | datetime | Nullable |

### Optional / ops

- **`saves`:** `user_id`, `place_id`, list `want` \| `been`
- **`reports`:** target, reason, status
- **`ingest_jobs`:** url or handle, status, last_error
- **`rank_snapshots`:** weekly leaderboard debug

**Place rank:** mentions × recency × creator credibility × distance × hide-spam. Same formula on map and list.

**Creator rank:** community ratio + vote floor + recency of votes; **not** followers. Use seed scores until the floor is met.

---

## 12. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Client | **Mobile web** (React or similar), PWA-first | KL launch; light embeds; no native app in MVP |
| API | Node.js + NestJS | Structured, scalable API |
| Database | PostgreSQL + PostGIS | Relational + KL proximity |
| Cache | Redis | Trending by geohash, oEmbed cache, leaderboard |
| Ingest | **Manual/curated first**; Python collectors later + LLM on ingest | Entity/sentiment cached; not per page view |
| Maps | Google Maps Platform / Mapbox | Map + Places; cache geocode; KL only |
| Media | oEmbed + thumbnails | **No object storage for video** |
| Auth | Email or social (pick one cheap path) | Required for vote and claim |

---

## 13. UI principles

- Session 1 = **map**: night map, heat pins, selected pin → place + embeds.
- **Ranker is visible** (trust number + leaderboard, not buried).
- **Stamps** (Legit / Hype), not stars.
- Light client: poster/thumbnail + official embed; no third-party files on our origin.
- KL copy: areas, **RM**, **km**, English + light Manglish OK.
- Sharing is **not** a design requirement. Later preview = place + creator + verdict.
- Empty/thin → **KL trending**, never a dead map.
- Claimed vs unclaimed obvious on creator pages.

---

## 14. Risks and mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | Platform ToS / API cost / scraping limits | Blocks ingest or legal exposure | oEmbed + public URLs; **curated profiles first**; no video hosting; scrapers are not the only supply |
| 2 | Matching accuracy (wrong place) | Trust loss | Place ID; LLM proposes; human review on low confidence |
| 3 | Paid / incentivized hype | Scores meaningless | Sponsored flag (manual + claim + report); community score |
| 4 | Empty leaderboard | Ranker feels fake | Seed + hand-score; vote floor |
| 5 | Vote farming | Distorted ranks | 1 vote / user / post; later account age + rate limits |
| 6 | Honor-system lies | Noisy scores | Accept on MVP; do not claim “verified visit” |
| 7 | Embed breakage | Dead clips | Thumbnail + outbound link |
| 8 | Claim impersonation | Fake verified creators | Manual verify only |

---

## 15. Rollout

1. Seed KL places + posts + hand-scores.
2. Ship Map + place + embed + auth + vote + creator pages + leaderboard + claim form.
3. Ops queue for claims and mismatch reports.
4. Only then deepen ingest automation.

**Launch line:** KL metro, mobile web, right-now map + influencer ranker.

---

## 16. Open items

**Answered (were open in the original SPEC)**

- [x] Launch geography: **KL metro**.
- [x] Auth: **accounts required to vote**; guests can browse.
- [x] Legal on re-hosting photos/video: **do not host**; oEmbed + thumbnail URLs only.
- [x] Restaurant meter: **aggregate of post-level Legit/Hype votes**.
- [x] Credibility (v1): `legit / (legit + hype)` + **minimum vote floor**; seed until then. Decay half-life still open.
- [x] “Top rated” filter: hide until **≥15** scored creators; exact numeric threshold still TBD.

**Still open**

- [ ] Lock vs allow vote change after submit (default: lock).
- [ ] Exact KL metro boundary vs named-area allowlist.
- [ ] Places provider (Google vs Mapbox) and budget cap.
- [ ] Auth provider.
- [ ] Whether **Saved** ships in v1.
- [ ] Exact `weighted_rank` coefficients and recency half-life.
- [ ] Credibility decay half-life after v1 formula.
- [ ] Ingestion cadence once collectors exist (daily batch is enough for curated MVP).
