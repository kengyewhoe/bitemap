# BiteMap — v1 Specification

> **Status:** v1 scope, locked
> **One-liner:** Find good makan near you, and say whether it was worth it.
> **Market:** Klang Valley only (KL, PJ, Subang, Cheras, Puchong).

---

## 1. What v1 Is

Three screens, one loop:

**Login → see restaurants near me → open one → rate it good or bad.**

That's the whole build. Everything else in the product idea (credibility scoring, automated ingestion, maps, social features) is deferred to §10 and must not enter v1.

**What we're testing:** will people open BiteMap instead of Google Maps when deciding where to eat? If the nearby list isn't good enough to beat Google, no amount of scoring machinery fixes that. So v1 spends its effort on venue quality, not on algorithms.

**Where the quality comes from:** every venue enters the database because a real Malaysian food influencer recommended it, and we record *who*. A place recommended by four different influencers is visibly better than one recommended by one. That signal is free — it needs no votes, no formula, and no extra screen.

---

## 2. Scope Cap

**In — build exactly this**

| # | Feature | Definition of done |
|---|---|---|
| 1 | Login | Google sign-in. Account exists, session persists. |
| 2 | Location | Device location granted → coords stored for the session. Denied → manual area picker. |
| 3 | Nearby list | Restaurants within 5 km, nearest first. Name, photo, cuisine, price band, halal status, distance in km, **and how many influencers recommend it**. |
| 4 | Restaurant detail | Full info + the influencer recommendations that put it there + Waze / Google Maps deeplink. |
| 5 | Rating | One 👍 / 👎 per user per restaurant. Changeable. Counts shown on list and detail. |

**Out — explicitly not v1**

- Automated ingestion, LLM extraction, scraping pipelines.
- **Influencer screens of any kind** — no profile page, no "see everything they recommended", no leaderboard, no credibility score. The `influencers` table exists for data integrity and deduplication, not for a feature. This boundary is easy to cross by accident; don't.
- Map view, drive-time estimates, PostGIS.
- Filters and search of any kind. v1 *displays* halal, cuisine and price — it does not filter on them.
- Opening hours, seasonal closures, "open now".
- Following, comments, photo uploads, any UGC beyond the 👍/👎.
- Anything outside Klang Valley.

If a task doesn't serve one of the five rows above, it is not v1 work.

---

## 3. Flows

### 3.1 Onboarding — once
| Step | Screen | Action | Outcome |
|---|---|---|---|
| 1 | Splash | One line of value prop, one button | — |
| 2 | Login | Sign in with Google | `users` row created |
| 3 | Location | System permission prompt | Granted → coords held for session |
| 3b | Location denied | Area picker: Bangsar, TTDI, SS15, Damansara Uptown, Taman Connaught | Area centroid used as location |

Location is asked **after** login so the prompt has context. Denial is a normal path, not an error — Malaysians in basement car parks and mall food courts will hit it constantly.

### 3.2 Nearby list — the home screen
| Step | Action | Outcome |
|---|---|---|
| 1 | App opens | Restaurants within 5 km, nearest first |
| 2 | Scroll | Straight-line km, one decimal (`1.2 km`) |
| 3 | Nothing within 5 km | Show the nearest 10 regardless of distance + a line saying coverage is Klang Valley for now |

Each card: photo, name, area, cuisine tags, price band, halal status, distance, `👍` count, and **`4 influencers`** when more than one has recommended it.

### 3.3 Restaurant detail
| Section | Content |
|---|---|
| Header | Photo, name, area, distance |
| Facts | Cuisine tags, price band, halal status, `hours_note` free text (`"Tutup Isnin"`, `"6pm sampai habis"`) |
| Why it's here | **Recommended by @a, @b, @c** — then their Instagram posts, embedded via oEmbed, **never rehosted** |
| Action | **Waze** button (primary) + Google Maps button |
| Rating | 👍 / 👎 with current counts |

Handles are shown as plain text, not links to a profile screen. There is no profile screen in v1.

Waze is primary. It is what Malaysians actually open for last-mile navigation.

### 3.4 Rating
- One rating per `(user_id, venue_id)`. Tapping the other option flips it; tapping the same option clears it (the row is deleted).
- Counts display as `👍 12 · 👎 3`. A percentage appears only at **≥ 5 ratings** — below that it reads `Baru — not enough ratings yet`.
- Ratings do not affect list ordering in v1. This keeps the first cohort's votes from being distorted by an untested ranking formula.

---

## 4. Data Model

Six tables and one view. Postgres. No PostGIS in v1 — `lat`/`lng` as `double precision`, distance via haversine in SQL over a few hundred rows.

**The shape:** two independent write paths converge on `venues`. Curation flows in through `influencers → recommendations`; user opinion flows in through `users → ratings`. Neither path owns the venue — both reference it. This is what makes "recommended by 4 influencers, 12 of 15 users say sedap" a single, cheap query.

```
[influencers] ──1:N──> [recommendations] ──N:1──┐
                                                 ├──> [venues]
[users] ──────1:N──> [ratings] ─────────────N:1──┘
```

### `influencers`
The curation source. Exists so the same person is one row no matter how many places they recommend — that is what makes deduplication and "4 influencers" possible.

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `handle` | text, **unique** | `@makanwithdanny`. Uniqueness is what makes the count trustworthy. |
| `display_name` | text | |
| `platform` | enum | `instagram` — single value in v1 |
| `follower_count` | int, nullable | Snapshot at seeding. Recorded, not used. |
| `is_active` | bool | Default `true`. Lets us stop seeding from someone without deleting history. |

**No `credibility_score` in v1.** The moment that column exists, someone builds a leaderboard.

### `recommendations`
One row per post. Replaces the old `venue_posts` — same job, but it now links two real entities instead of dangling off a venue with a string attached.

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `influencer_id` | FK → `influencers.id` | |
| `venue_id` | FK → `venues.id` | |
| `post_url` | text, **unique** | Canonical permalink. Uniqueness prevents the same post being entered twice and inflating a venue's count. |
| `posted_at` | date | Sort order on the detail page, newest first |
| `note` | text, nullable | Seeder's own line — *"specifically the sambal petai"* |

### `venues`
Referenced by both paths, derived from neither — so a place can be seeded before anyone posts about it.

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `name` | text | Primary display name |
| `name_aliases` | text[] | Chinese / Malay / romanisation variants. Not searched in v1 — captured at seeding so the work isn't repeated when search ships. |
| `area` | text | `Bangsar`, `SS15`, `TTDI`. Plain text — no `areas` table until boundaries are needed. |
| `lat` / `lng` | double precision | |
| `address` | text | Malaysian format, as written on the shopfront |
| `venue_type` | enum | `restaurant` \| `stall` \| `cafe` \| `kopitiam` \| `mamak` |
| `cuisine_tags` | text[] | 1–3 per venue, see Appendix A |
| `price_band` | enum | See 4.1 |
| `halal_status` | enum | See 4.2 |
| `hours_note` | text | Free text, human-written. Replaces an hours/closures schema entirely. |
| `photo_url` | text | Our own or licensed — **never a hotlinked influencer photo** |
| `google_place_id` | text, nullable | Builds the Maps deeplink. Null for stalls Google doesn't list. |
| `is_published` | bool | Default `false`. Nothing reaches the app until a human flips it. |

### 4.1 `price_band`
Per person, typical order. Granular at the low end, where Malaysian price sensitivity actually sits.

`under_rm10` · `rm10_25` · `rm25_50` · `rm50_plus`

### 4.2 `halal_status`
Multi-state and **two-sided** — one segment filters for certification, another filters for pork, and both treat a wrong answer as a betrayal. Never collapsed to a boolean.

| Value | Meaning |
|---|---|
| `jakim_certified` | Holds a JAKIM / state authority certificate |
| `muslim_owned` | Muslim-owned, no formal certificate |
| `pork_free` | No pork, but uncertified and/or serves alcohol |
| `non_halal` | Serves pork |
| `unknown` | **Default.** Shown as "Not verified". Never inferred optimistically. |

### `users`
| Field | Type | Notes |
|---|---|---|
| `id` | PK (uuid) | Supabase auth user id |
| `email` | text | From Google |
| `display_name` | text | Not shown to other users in v1 |
| `created_at` | timestamptz | |

### `ratings`
| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `user_id` | FK → `users.id` | |
| `venue_id` | FK → `venues.id` | |
| `rating` | enum | `good` \| `bad` |
| `updated_at` | timestamptz | |

Unique constraint on `(user_id, venue_id)`.

### 4.3 `venue_cards` — the view the app reads

This is how recommendations "reflect on" the venue, and it is a **view, not a trigger**. Counter columns on `venues` would drift the first time a row was deleted or double-entered; a view cannot.

| Column | Derivation |
|---|---|
| everything on `venues` | — |
| `influencer_count` | `count(distinct recommendations.influencer_id)` |
| `last_recommended_at` | `max(recommendations.posted_at)` |
| `good_count` / `bad_count` | counts over `ratings` |

At 150 venues this aggregates in single-digit milliseconds. Revisit only when the row count makes it measurable — a materialised view refreshed on write is the next step, not a counter column.

---

## 5. Nearby Logic

```sql
SELECT * FROM venue_cards
WHERE is_published
  AND haversine(:user_lat, :user_lng, lat, lng) <= 5
ORDER BY distance_km ASC, influencer_count DESC
LIMIT 50
```

Distance decides the order. `influencer_count` breaks ties only — it is a display signal in v1, not a ranking one.

Drive time is the honest metric for KL traffic and is on the post-v1 list, but it needs a routing call per venue per request. Not worth the cost or latency before we know people use the list at all.

---

## 6. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| App | Next.js PWA (mobile web) | No app-store review cycle, links are shareable, one codebase. React Native follows once retention is proven — not before. |
| Auth | Supabase Auth, Google provider | Managed; no password handling |
| Database | Supabase Postgres | Plain lat/lng; PostGIS when a map view needs it |
| API | Next.js route handlers | The whole API is ~5 endpoints |
| Admin | Supabase table editor | Seeding is manual (§8). Do not build an admin UI. |
| Maps | Waze + Google Maps deeplinks | Zero API cost — deeplinks, not the Places API |
| Hosting | Vercel | |

No Redis. No NestJS. No Python ingestion service. No LLM calls anywhere in v1 — those belong to the automated pipeline, which is post-v1.

---

## 7. Localisation Rules

Binding for schema, copy, and UI.

- **km, never miles.** One decimal.
- **RM** prefixed, comma thousands. Dates DD/MM/YYYY.
- **Areas, not postcodes.** Malaysians navigate by Bangsar / SS15 / TTDI.
- **Register:** conversational Malaysian English. "Jom makan" over "Discover Dining". Light touch — heavy Manglish in UI reads as try-hard.
- **"Western"** here means the RM12 chicken-chop stall genre, not fine dining.
- Halal status is never guessed, never rounded up, and `unknown` is displayed plainly.

---

## 8. Content Seeding

Influencer-first, because that is the order the information actually arrives in.

1. Add ~30 Klang Valley food influencers to `influencers`.
2. Work through one influencer's recent posts.
3. For each genuine recommendation, **look up the venue first**. Already there? Add a `recommendations` row pointing at it — its count goes to 2, and that venue just got better. Not there? Create it, filling every field including `halal_status` and `hours_note`, then add the recommendation.
4. Flip `is_published` once the venue's fields are complete.

Step 3 is the entire point of this model. Venue-first seeding would have quietly created duplicate rows for the same stall and thrown away the corroboration signal.

**Target: 150 published venues across 5 Klang Valley areas before launch** — roughly 30 per area, enough that the nearby list is never thin.

Deliberately manual. It is faster than building the pipeline, it produces the labelled data the future pipeline is evaluated against, and it forces us to see every venue we ship.

---

## 9. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Thin list** — user opens the app and sees 3 places | 150-venue seeding target; fall back to nearest 10 when nothing is within 5 km |
| 2 | **Halal misclassification** — severe trust failure in both directions | Default `unknown`; human-set only; never inferred |
| 3 | **Image copyright / PDPA** | Never rehost influencer photos. Posts embed via oEmbed permalinks; `photo_url` is our own or licensed. |
| 4 | **Location denied or inaccurate** (basements, malls) | Manual area picker is a first-class path, not an error state |
| 5 | **Rating brigading** | Login required; one rating per user per venue enforced by unique constraint |
| 6 | **Inflated influencer counts** — same post entered twice, or one person counted as two handles | `post_url` unique; `handle` unique; count is `distinct influencer_id`. All three are needed. |
| 7 | **Influencer-table scope creep** | §2 forbids influencer screens outright. The table is infrastructure, not a feature. |

---

## 10. Deferred — Post-v1 Backlog

Cut deliberately. Preserved so nothing is re-litigated, and so v1 schema choices don't block them.

- **Credibility layer:** `credibility_score`, Legit-vs-Hype voting on recommendations, leaderboards, "top-rated creators only". The `influencers` and `recommendations` tables are already the right shape to carry these.
- **Influencer screens:** profile page, full recommendation history. The query works today; the screen is post-v1.
- **Automated ingestion:** collectors via managed providers (logged-out only), LLM caption extraction, sentiment, sponsored-post detection.
- **Venue resolution ladder:** IG location tags → Google Places matching → `match_confidence` → review queue. (v1's manual lookup in §8 step 3 is this done by hand.)
- **Time:** `venue_hours`, `venue_closures` (Raya, CNY), "open now".
- **Geo:** map view, PostGIS, drive-time ranking, `areas` table with boundaries and aliases.
- **Discovery:** search, halal filter, cuisine filter, price filter, area browse.
- **Structure:** `parent_venue_id` for stalls inside food courts, per-field provenance, amenities (parking, DuitNow QR, TnG).
- **Performance:** materialised `venue_cards` refreshed on write, once the live view is measurably slow.
- **Expansion:** Penang, JB. TikTok. Bazaar Ramadan seasonal mode.
- **Native app:** React Native, once web retention justifies it.

---

## 11. Decisions

Previously open, now settled for v1.

| Question | Decision |
|---|---|
| Auth model | Google sign-in required. Rating needs an account; browsing does not. |
| Rating granularity | Venue-level 👍/👎, one per user. No post-level or influencer-level scoring. |
| Does rating affect ordering? | No. Distance only. |
| Does influencer count affect ordering? | Tie-break only. Displayed, not ranked on. |
| Minimum ratings before showing a percentage | 5 |
| Are venues derived from recommendations? | No — referenced. A venue can exist with zero recommendations. |
| How does the count reach the venue? | A view (`venue_cards`), not a trigger or counter column. |
| Ingestion cadence | Manual, continuous, influencer-first |
| Who staffs review | Founder. There is no queue — nothing is auto-created. |
| Halal sourcing | Human-set per venue at seeding. No JAKIM scrape. |
| Search radius | 5 km, straight-line |
| Platforms | Instagram only |

---

## Appendix A — Cuisine Tags

Generic taxonomies ("Chinese", "Asian") are useless here. One flat list of how Malaysians actually describe a place. Pick 1–3 per venue.

`mamak` · `kopitiam` · `economy_rice` (chap fan / nasi campur) · `zi_char` (tai chow) · `nasi_kandar` · `banana_leaf` · `bak_kut_teh` · `dim_sum` · `steamboat` · `roti_canai` · `nasi_lemak` · `hawker_stall` · `cafe` · `western` · `japanese` · `korean` · `thai` · `nyonya`
