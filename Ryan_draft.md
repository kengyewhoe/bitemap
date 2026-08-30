# BiteMap PRD

**Product:** BiteMap  
**Type:** Mobile web app (PWA-first)  
**Launch market:** Kuala Lumpur metro only  
**Stage:** MVP  
**Status:** Draft for build  
**Author:** Ryan  
**Last updated:** 2026-08-30

---

## 1. Vision

BiteMap turns fragmented social food content into **actionable “where should I eat right now” decisions** in KL, and adds a **community ranker for food influencers**.

Viral clips are mapped to real places. The community stamps each tip **Legit** or **Hype**. That score is the product: not another review site, a **trust layer on creators**.

**Positioning:** “What’s actually good near you tonight — and which KL food accounts you can trust.”

**Not:** Yelp, Google reviews, a TikTok clone, or a social network.

---

## 2. Locked product decisions

| Decision | Call |
|---|---|
| Session 1 job | **Right now.** Location → nearby trending → place + clips → go. Not weekend planning. |
| Core appeal | **Influencer ranker** (community trust), not a sharing/social graph. |
| Share unit (if we add later) | Place + influencer + verdict. Not required for MVP. |
| Cold start | **Seed KL inventory** and **hand-score** a starter set of creators. Do not launch an empty graph. |
| Geography | **KL city metro only.** No national, no other cities. |
| Influencers | **Both inventory and users.** They can claim a profile. **Verification is manual** for now. |
| Video | **oEmbed / official embeds only.** Thumbnails + link/embed. **Do not host full videos.** Keep the client light. |
| Visit proof | **Honor system** on MVP (“I went”). No geo check-in required to vote. |
| Voting | **One vote per user per post.** |
| Launch surface | **Mobile web**, KL-focused. |

---

## 3. Who it’s for

**Primary user:** Someone in KL deciding dinner in the next ~20 minutes.

**Secondary:** People who follow KL food accounts and want a **trust ranking** before they queue.

**Creators:** KL food influencers who want a public trust profile they can claim.

**Out of scope for MVP:** tourists as a separate persona, group planning, multi-city, restaurant admin dashboards.

---

## 4. Goals and non-goals

### Goals (MVP)

- Show **trending places near me** from recent influencer mentions (default radius **5 km**, KL only).
- Open a place and see the **clips/posts that made it trend** (embed + summary, not hosted video).
- Let signed-in users stamp a post **Legit** or **Hype** (honor-system visit).
- Show a **simple credibility score** per influencer and a **KL leaderboard**.
- Let influencers **request a claim**; ops **approves manually**.

### Non-goals (MVP)

- Share cards, Stories exports, referral loops, following graph.
- Scrapers as the only supply; full TikTok/IG file hosting.
- Automatic visit verification, “I’m here” geofence as a hard gate.
- Multi-platform completeness, dietary/price as rank drivers.
- Paid restaurant placement, ads, auto-verified creator badges.
- Native iOS/Android apps.

---

## 5. Success metrics

**North star:** Opens that end in a **place view** or **Directions tap** in a session (dinner-occasion utility).

**Secondary**

- % of sessions with location (or KL city fallback) that see **≥3 places** in the nearby feed.
- Votes per week (quality: unique user × post).
- Leaderboard visits (ranker is the brand).
- Claim requests / approved claims.

**Guardrails**

- Wrong-place match rate (ops + reports).
- Repeat voters / suspected vote farming.
- Page weight: **no full video downloads** from our origin.

Do **not** optimize for “posts ingested” as the product metric.

---

## 6. User experience

### 6.1 Quick-start (session 1 — default)

1. **Onboarding:** Ask for location. If denied, **Browse Kuala Lumpur** (city centroid / popular areas). One screen, no long carousel.
2. **Home:** Immediate **Trending Nearby** on a night map + tray (recent mentions, ~5 km, recency-weighted).
3. **Tap place:** Restaurant profile — embeds that put it on the map, photos from posts where we only store **thumbnail URLs**, **Legit vs Hype** on the place (aggregated from post votes).
4. **Action:** Directions (Google Maps / Apple Maps / Waze via system) or Save (nice-to-have if cheap; not required if it slips).

### 6.2 Detailed discovery

- Restaurant profile: aggregated mentions, embed players, **Legit vs Hype** meter.
- Filter chip: **High-trust creators only** (hide until enough scores exist; don’t ship an empty filter).
- Chip: **Hide sponsored** when a post is tagged sponsored.

### 6.3 Influencer evaluation (core loop)

- Influencer profile: recommendation history (places + posts + running score).
- User eats (offline), returns, stamps that **post** Legit or Hype.
- Score updates **legit_count / hype_count / credibility_score**.
- **Leaderboard:** KL creators ranked by **community trust**, not follower count.

### 6.4 Claim flow

- Unclaimed profile: “This is BiteMap’s page for @handle” + **Claim**.
- Claim form: handle(s), proof (e.g. bio link or screenshot). Status: pending / approved / rejected.
- Ops approves in a **manual queue** (admin or spreadsheet + flag in DB is enough for MVP).
- Claimed: creator can add **sponsored** flags, suggest place corrections (ops still confirms). They **cannot** delete community votes.

---

## 7. Information architecture (mobile web)

**Tabs**

1. **Map** — default home
2. **Rank** (or “Creators”) — leaderboard + search creators — *this is the brand, keep it one tap*
3. **Saved** — optional MVP; cut if needed
4. **Me** — votes, claim entry, city = KL

Restaurant and clip/post are **pages or sheets**, not tabs.

**Rank tab is first-class** because the appeal is the influencer ranker. Map still wins session 1.

---

## 8. MVP scope

### In

| Area | Requirement |
|---|---|
| Geo | KL metro bounding box / allowlist of areas. Nearby = default **5 km**. |
| Feed | Aggregated recent mentions; recency decay (prefer last **14–30 days**). |
| Place page | Name, area, category, mention count, meter, list of posts with **oEmbed**. |
| Post | Platform, URL, embed, summary, restaurant link, influencer, sponsored flag. |
| Voting | Auth required. Honor “I went.” **One vote per user per post.** Change vote allowed (last write wins) or lock — pick one in build; default **lock after submit**. |
| Credibility | Simple: `credibility = legit / (legit + hype)` with **minimum vote floor** before ranking. Hand-seed scores for launch set. |
| Leaderboard | KL, trust-based, show vote volume. |
| Claim | Request + manual verify. |
| Ingest | **Curated / manual + light collectors.** LLM for entity/sentiment **on ingest only**, cached. Match to **Google Place ID**. |
| Media | Thumbnail URL + embed HTML/oEmbed. **Zero video bytes on our CDN.** |

### Out / later

- Share cards, deep-link OG images, Stories.
- Geo visit proof, vote weight by account age (design now, enforce later if abused).
- Auto claim, multi-city, native apps.
- Following, comments, DMs.
- Heavy scrapers as primary supply.

### Launch inventory (cold start)

- Seed **one metro**: target **~80–150 places** and **~30–50 creators** with ≥1 mapped post each.
- Hand-score those creators so the leaderboard is not empty.
- Thin areas: still show **KL trending**, never a blank map.

---

## 9. Trust, spam, sponsored

**Legit vs Hype rubric (show in UI once)**

- **Legit:** Food/experience matched the clip; worth the trip/queue.
- **Hype:** Camera bait, bait-and-switch, not worth queue/price, or “nothing like the video.”
- Stamp scores the **tip/post** (and thus the creator), not a 1–5 restaurant review.

**Rules**

- One vote per `(user_id, post_id)`.
- New accounts: store `account_created_at`; optional later down-weight.
- Sponsored: **manual + creator claim + user report**. Unlabeled ads must be reportable.
- No “verified visit” copy on MVP. Copy: “You said you went.”
- Reports: wrong place, closed, spam, not food, impersonation.

---

## 10. Data, matching, legal

- **Source of truth for venues:** Google Place ID (or equivalent Places provider). LLM **proposes**; human or high-confidence match **commits**.
- Aliases, food courts, stalls, same name in two areas: never match on name alone.
- Closed/moved: use Places operational status; dim “might be closed.”
- **Identity:** `creator_id` (person) vs `platform_account` (TikTok/IG handle).
- **oEmbed** for TikTok/IG (and others if they offer it). If embed fails, **thumbnail + open original**.
- **No ripping or storing full videos.** Comply with platform ToS; takedown = drop embed, keep metadata if legal.
- Claim/remove for names/faces on rank pages.
- Location: coarse for feed; don’t keep high-precision tracks. Guest browse KL without an account; **account required to vote.**

---

## 11. Data model (outline)

**Users**  
`id`, auth, display_name, created_at, last_city (`KL`), role (`user` \| `ops`)

**Creators**  
`id`, name, niche_tags, credibility_score, legit_count, hype_count, claim_status (`unclaimed` \| `pending` \| `verified` \| `rejected`), claimed_by_user_id, seed_score_notes

**PlatformAccounts**  
`id`, creator_id, platform, handle, external_id, follower_count (optional, cached)

**Places**  
`id`, provider_place_id, name, location (PostGIS), address, area (e.g. Bangsar), category, operational_status, total_mentions, weighted_rank

**Posts**  
`id`, creator_id, platform_account_id, platform, post_url, embed_html / oembed_cache, thumbnail_url, content_summary, sentiment_score, place_id, timestamp, is_sponsored, ingest_status

**UserRatings**  
`id`, user_id, creator_id, post_id, rating_type (`legit` \| `hype`), timestamp  
Unique `(user_id, post_id)`

**ClaimRequests**  
`id`, creator_id, user_id, proof_note, status, reviewed_by, reviewed_at

**Saves** (optional MVP)  
`user_id`, `place_id`, list (`want` \| `been`)

**Reports**  
target type/id, reason, status

**IngestJobs**  
url or handle, status, last_error

**Rank snapshots** (optional) — weekly leaderboard debug

**Ranking (places):** mentions × recency × creator credibility × distance × hide-spam. Write the formula in code comments and keep Map vs list in sync.

**Ranking (creators):** community ratio + vote floor + recency of votes; **not** followers. Seeded scores until floor is met.

---

## 12. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Client | Mobile web (React or similar) | Light: embeds, not a video CDN. |
| API | Node.js + NestJS | |
| DB | PostgreSQL + PostGIS | KL bbox queries. |
| Cache | Redis | Nearby trending by geohash, oEmbed cache, leaderboard. |
| Ingest | Manual/curated first; Python collectors later | GPT-class model for extract **on ingest**, cached. |
| Maps | Google Maps / Mapbox | Cache tiles/geocode; KL only. |
| Media | oEmbed + thumbnails | No object storage for video files. |
| Auth | Email/social — pick one cheap path | Required for vote/claim. |

---

## 13. UI principles

- **Session 1 = map.** Night map, heat pins, selected pin → place + embeds.
- **Ranker is visible:** trust number and leaderboard are not buried in settings.
- **Stamps** are the interaction (Legit / Hype), not stars.
- Keep the client **light**: poster/thumbnail + official embed player; no auto-download of third-party files to our servers.
- KL copy: areas, **RM**, **km**, English + light Manglish OK.
- Sharing is **not** a design requirement. If a share API appears later, preview = place + creator + verdict.
- Empty/thin: fallback to **KL trending**, never a dead map.
- Claimed vs unclaimed should be obvious on the creator page.

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Platform ToS / API cost | oEmbed + public URLs; curated ingest; no video hosting. |
| Wrong “Joe’s Pizza” | Place ID + human review on low-confidence matches. |
| Paid hype | Sponsored flag, reports, community score. |
| Empty leaderboard | Seed + hand-score; vote floor. |
| Vote farming | 1 vote / user / post; later: account age, rate limits. |
| Honor-system lies | Accept on MVP; don’t claim “verified visit.” |
| Embed breakage | Thumbnail + outbound link fallback. |
| Claim impersonation | Manual verify only. |

---

## 15. Rollout

1. Seed KL places + posts + hand-scores.
2. Ship Map + place + embed + auth + vote + creator pages + leaderboard + claim form.
3. Ops queue for claims and mismatch reports.
4. Only then deepen ingest automation.

**Launch line:** KL metro, mobile web, right-now map + influencer ranker.

---

## 16. Open items

- Lock vs allow vote change after submit.
- Exact 5 km vs “KL areas” list for “metro.”
- Places provider (Google vs Mapbox) and budget cap.
- Auth provider.
- Whether **Saved** ships in v1.
- High-trust filter: hide until N scored creators (recommend **≥15**).
