# BiteMap — Technical Specification

> **Status:** Draft / pre-MVP
> **Source:** `initial_thoughts.txt` (original free-form notes)
> **One-liner:** Influencer-driven food discovery — turn viral social food content into mapped, credibility-scored dining decisions.

---

## 1. Product Vision

BiteMap centralizes the fragmented world of social media food reviews. It transforms viral content into actionable dining decisions by:

1. **Mapping** influencer recommendations to physical restaurant locations.
2. **Aggregating** posts across platforms into a single restaurant profile.
3. **Verifying** credibility through community feedback ("Legit vs. Hype").

**Problem being solved:** A user sees a food video, cannot tell if the place is genuinely good or a paid promotion, and cannot easily find it or others like it nearby.

---

## 2. User Experience Flows

### 2.1 Quick-Start Flow
| Step | Screen | Action | Outcome |
|---|---|---|---|
| 1 | Onboarding | User grants location access | Location permission stored |
| 2 | Home Feed | App loads "Trending Nearby" | List of restaurants ranked by recent influencer mentions |
| 3 | Feed → Detail | User taps a restaurant | Shows the specific influencer posts driving the trend |

### 2.2 Detailed Discovery Flow
| Step | Screen | Action | Outcome |
|---|---|---|---|
| 1 | Restaurant Profile | User opens a restaurant | Aggregated reviews (TikTok, IG, etc.), photos extracted from posts, "Legit vs. Hype" meter |
| 2 | Restaurant Profile | User toggles "Top Rated Influencers Only" | Feed filters to creators above a credibility threshold |

### 2.3 Influencer Evaluation Flow
| Step | Screen | Action | Outcome |
|---|---|---|---|
| 1 | Influencer Profile | User opens a creator | Full history of their recommendations |
| 2 | Post / Restaurant | User visits the restaurant, returns to app | Rates the tip as **Legit** or **Hype** |
| 3 | System | Vote recorded | Influencer `credibility_score` recalculated |

---

## 3. Data Model

### `influencers`
| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `name` | string | Display name |
| `platform_handles` | json | e.g. `{ "tiktok": "@x", "instagram": "@x" }` |
| `follower_count` | int | Snapshot, refreshed on ingest |
| `niche_tags` | string[] | e.g. `["sushi", "budget-eats"]` |
| `credibility_score` | float | Derived from `legit_count` / `hype_count` |
| `legit_count` | int | Aggregate of positive user ratings |
| `hype_count` | int | Aggregate of negative user ratings |

### `posts`
| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `influencer_id` | FK → `influencers.id` | |
| `platform` | enum | `tiktok` \| `instagram` \| … |
| `post_url` | string | Canonical source link |
| `content_summary` | text | LLM-generated |
| `sentiment_score` | float | LLM-generated |
| `restaurant_id` | FK → `restaurants.id` | Nullable until matched |
| `timestamp` | datetime | Original post time |

### `restaurants`
| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `name` | string | |
| `location_coord` | geography(Point) | PostGIS |
| `address` | string | |
| `category` | string | Cuisine / type |
| `total_mentions` | int | Denormalized counter |
| `weighted_rank` | float | Mentions weighted by influencer credibility + recency |

### `user_ratings`
| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `user_id` | FK | |
| `influencer_id` | FK → `influencers.id` | |
| `post_id` | FK → `posts.id` | |
| `rating_type` | enum | `legit` \| `hype` |
| `timestamp` | datetime | |

**Relationships:** `influencers` 1—N `posts` N—1 `restaurants`; `user_ratings` N—1 `posts`.

---

## 4. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React Native | Cross-platform mobile from one codebase |
| Backend | Node.js + NestJS | Structured, scalable API layer |
| Database | PostgreSQL + PostGIS | Relational data + geospatial proximity queries |
| Cache | Redis | Trending feeds, proximity ranking |
| Data ingestion | Python collectors/scrapers + LLM extraction | Sentiment & entity extraction from post text |
| Maps | Google Maps Platform / Mapbox | Rendering + Places metadata |

---

## 5. MVP Scope

**In scope**
1. **Nearby Influencer Feed** — aggregated list of recent mentions within a 5-mile radius.
2. **Basic Credibility System** — Legit/Hype voting on influencer posts.
3. **Restaurant Detail Pages** — social posts linked to a Google Maps location.
4. **Influencer Leaderboard** — creators ranked by community trust.

**Explicitly out of scope for MVP**
- Multi-city / multi-region expansion beyond the launch area.
- Automated sponsorship detection beyond a manual/declared "Sponsored" tag.
- Social features (following, comments, user-generated posts).

---

## 6. Risks & Mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | **Data sourcing** — scraping limits and API costs for TikTok/Instagram | Blocks core ingestion | Focus on a curated set of high-value public profiles; use web crawlers rather than paid APIs at MVP scale |
| 2 | **Matching accuracy** — resolving the wrong "Joe's Pizza" | Wrong data shown to users; trust loss | Use an LLM to cross-reference post text against Google Places API metadata before committing a match |
| 3 | **Incentivized hype** — paid promotions skew the data | Credibility scores become meaningless | Mandatory "Sponsored" tagging plus community-driven credibility decay over time |

---

## 7. Open Questions

- [ ] How is `credibility_score` computed exactly (formula, decay half-life, minimum vote threshold)?
- [ ] How is `weighted_rank` computed (mention count × credibility × recency weighting)?
- [ ] What defines the "Legit vs. Hype" meter on a restaurant — post-level or aggregate influencer scores?
- [ ] What is the credibility threshold for "Top Rated Influencers Only"?
- [ ] Auth model: anonymous voting, or accounts required? (`user_ratings.user_id` implies accounts.)
- [ ] Ingestion cadence: real-time, hourly, or daily batch?
- [ ] Launch geography / initial city?
- [ ] Legal posture on scraping and re-hosting extracted post photos.
