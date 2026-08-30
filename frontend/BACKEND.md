# BiteMap frontend — backend required

Normative spec: [`../BACKEND_REQUIREMENTS.md`](../BACKEND_REQUIREMENTS.md) (data model, scoring, invariants, jobs).

The screens in `frontend/` run on **mock data + `localStorage`**. Nothing is persisted on a server. Below is the API surface each screen needs.

Auth: send `Authorization: Bearer <access_token>` on all routes except login/signup.

KL only. Distances in **km**. Votes are **Good / Bad** on a **place** (honor-system “I went”). One vote per user per place; lock after submit.

---

## Screen → APIs

### Login (`login.html`)

| Action | Method | Path | Body / notes |
|---|---|---|---|
| Email continue | `POST` | `/auth/magic-link` or `/auth/otp` | `{ email }` — send link/code |
| Google | `GET` | `/auth/google` | OAuth redirect; return JWT + user |
| Session | `GET` | `/me` | Current user |

**Logic:** Create or fetch `users`. Issue JWT. No vote without an account.

---

### Location (`location.html`)

Client reads GPS. Backend does **not** need to store precise tracks.

| Action | Method | Path | Notes |
|---|---|---|---|
| Optional save coarse point | `PATCH` | `/me` | `{ last_city: "KL", coarse_geohash }` |
| Fallback | — | — | If denied, client uses KL centroid `(3.139, 101.687)` |

**Logic:** Never store high-precision history. Use coords only as query params on nearby.

---

### Follow onboarding (`follow.html`) + Influencers tab (`influencers.html`)

| Action | Method | Path | Notes |
|---|---|---|---|
| List / search | `GET` | `/creators?q=&cursor=` | Handle, bio, tags, avatar, `following` |
| Follow | `PUT` | `/me/following/:creatorId` | |
| Unfollow | `DELETE` | `/me/following/:creatorId` | |
| Seed list | `GET` | `/creators?recommended=1` | Curated KL set for onboarding |

**Logic:** `follows(user_id, creator_id)`. Search is `ILIKE` on handle/name/tags. Skip is allowed (empty follow set).

---

### Home map (`home.html`)

Map tab is nearby discovery: pins + search + filters + list. List has **Nearby** and **Following** (Trending / New).

| Action | Method | Path | Notes |
|---|---|---|---|
| Nearby pins + Nearby list | `GET` | `/places/nearby?lat=&lng=&radius_km=5&halal=&q=&sort=&category=&followed=0` | Pins always use this. `q` is **fuzzy on the server** |
| Following · Trending | `GET` | `/places/nearby?...&followed=1&sort=rank` | Auth. Mentions from followed creators |
| Following · New | `GET` | `/places/nearby?...&followed=1&sort=recent` | Auth. Latest followed `posted_at` |
| Place peek | `GET` | `/places/:id/preview` | Name, area, km, good%, latest mention quote + thumb |
| Recenter | client | — | Re-call nearby with new lat/lng |
| Save | `PUT` | `/me/saves/:placeId` | From list bookmark |
| Unsave | `DELETE` | `/me/saves/:placeId` | |

**Logic:** PostGIS `ST_DWithin` inside KL bbox. Rank: recency of mentions × mention count × creator credibility. `heat` = high / med / low from that score (maps to chili / mango / lime). Cache in Redis by geohash ~5–15 min. Filters are cheap columns (`halal`, `category`). Search on name/area. `followed=1` empty → empty list + `empty_reason`, never KL trending. Pins stay on `followed=0`.

---

### Saved (`saved.html`)

| Action | Method | Path | Notes |
|---|---|---|---|
| List | `GET` | `/me/saves` | Place DTOs the user bookmarked |
| Unsave | `DELETE` | `/me/saves/:placeId` | |

**Logic:** Optional `saves` table. Empty state if none.

---

### Place profile (`place.html`)

| Action | Method | Path | Notes |
|---|---|---|---|
| Detail | `GET` | `/places/:id` | Address, hours, category, price, walk-min (client can compute), blurb, good%, stars-optional |
| Mentions | `GET` | `/places/:id/posts` | `platform, post_url, thumbnail_url, oembed_html, handle, quote` |
| Hours | from Places API | cached on `places` | Refresh daily |

**Logic:** `provider_place_id` is source of truth. Posts: store URL + thumbnail + cached oEmbed HTML. **Do not host video.** Directions = client opens Google Maps with `name + address` or `place_id`.

---

### Rate (`rate.html`)

| Action | Method | Path | Body |
|---|---|---|---|
| Submit | `POST` | `/places/:id/ratings` | `{ type: "good" \| "bad" }` |
| Mine | `GET` | `/places/:id/ratings/me` | `{ type }` or 404 |

**Logic:** Unique `(user_id, place_id)`. Reject second vote (`409`). Increment `good_count` / `bad_count`. `good_pct = good / (good + bad)`. Honor system — no geo proof. Do not copy “verified visit.”

---

### Creator profile (`influencer.html`)

| Action | Method | Path |
|---|---|---|
| Profile | `GET` | `/creators/:id` |
| Picks | `GET` | `/creators/:id/places` |
| Follow | same as influencers tab | |

**Logic:** `influence` / trust = `good / (good+bad)` across their posts/places with a vote floor; seed scores until then. `trusted` badge when floor met. `claim_status` can show Unclaimed vs verified (manual ops later).

---

### Me (`me.html`)

| Action | Method | Path |
|---|---|---|
| Profile | `GET` | `/me` |
| Counts | `GET` | `/me/stats` | ratings count, saves count |
| Logout | `POST` | `/auth/logout` | revoke refresh token |
| Password / Google link | later | |

**Logic:** Settings toggles (push, dark theme) can stay client-only for MVP.

---

## Minimum tables

`users` · `creators` · `platform_accounts` · `places` · `posts` · `user_ratings` (unique user+place) · `follows` · `saves` (optional)

## Out of scope for these screens

Video hosting, scrapers as the live path, visit geofence, claim admin UI, share cards, multi-city.

## Suggested build order

1. Auth + `/me`  
2. Seed `places` + `posts` + `creators`  
3. `GET /places/nearby` + `GET /places/:id`  
4. `POST /places/:id/ratings`  
5. Follow + creator pages  
6. oEmbed cache on ingest  
