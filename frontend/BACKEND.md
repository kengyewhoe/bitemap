# BiteMap frontend — backend contract (MVP)

Normative spec: [`../BACKEND_REQUIREMENTS.md`](../BACKEND_REQUIREMENTS.md) (schema, RLS, full endpoint detail). This file is the screen-by-screen cheat sheet for the FE build — every JSON example below is copied verbatim from that file.

The screens in `frontend/` currently run on mock data (`js/mock.js`) + `localStorage`. This is the contract for wiring the **kept MVP screens** to the real API. Endpoints not listed here do not exist — do not add calls to `/creators`, `/creators/leaderboard`, `/me/following/*`, `/me/saves/*`, `/reports`, or any `/auth/otp/*` / `/auth/magic-link` route.

**Auth:** Google sign-in only, via the Supabase JS client directly (no custom `/auth/*` route on this API). Send the Supabase session's access token as `Authorization: Bearer <token>` on the two auth-required routes (`POST /places/:id/ratings`, `GET /me` and `GET /places/:id/ratings/me`); every other route works with or without it.

**KL only.** Distances in **km**, one decimal. Prices as `price_band` (RM bands), never a raw number. Ratings are **Good / Bad on a place**, one vote per user per place, locked after submit.

---

## Screen → APIs

### Login (`login.html`)

| Action | Method | Path | Notes |
|---|---|---|---|
| Google sign-in | — | Supabase JS client, Google provider | `supabase.auth.signInWithOAuth({ provider: 'google' })`. No custom endpoint. |
| Session | GET | `/me` | Confirms the session server-side and returns the current user. |

**Change from the mock:** the email input + "Sign in with Google" secondary button in `login.html` becomes **Google-only** — hide or disable the email field and its `Email address` label for MVP. There is no `/auth/otp/*` or `/auth/magic-link` route to call.

### Location (`location.html`)

| Action | Notes |
|---|---|
| Request device location | `navigator.geolocation.getCurrentPosition(...)`, unchanged from the mock. |
| Denied / unavailable | Fall back to the KL centroid `(3.139, 101.687)` — same value already in `js/mock.js`'s `KL_CENTER`. |
| Store | Nothing server-side. `lat`/`lng` are query params on `/places/nearby` only — never persisted. |

### Home map (`home.html`)

| Action | Method | Path | Notes |
|---|---|---|---|
| Nearby pins | GET | `/places/nearby?lat=&lng=&radius_km=5` | Same call feeds the list screen (`discovery.html`) — one endpoint, two renderings. |
| Recenter | client | — | Re-call nearby with the new `lat`/`lng`. |
| Place peek | — | *(no `/places/:id/preview` in MVP)* | Use the nearby item's own fields (`good_pct`, `mention_count`, `latest_mention`) for the map's peek card — don't fetch place detail until the user taps through. |

**`heat` → pin color.** The API returns `heat: "high" | "medium" | "low"`; the FE maps that to the existing pin classes:

| API `heat` | Pin class (unchanged from `home.html` / `theme.js`) | Color |
|---|---|---|
| `high` | `chili` (`bg-map-chili`) | `#FF3B30` |
| `medium` | `mango` (`bg-map-mango`) | `#FFB020` |
| `low` | `lime` (`bg-map-lime`) | `#C8F542` |

`js/mock.js` currently sets `heat` directly to `"chili"/"mango"/"lime"` — that's a mock-only shortcut. The real API never returns those strings; add the `high→chili, medium→mango, low→lime` mapping when wiring `home.html` to `/places/nearby`, don't just rename the field.

**Request:**

```
GET /places/nearby?lat=3.1287&lng=101.6788&radius_km=5
```

**Response `200`** (copied from `BACKEND_REQUIREMENTS.md` §8.2):

```json
{
  "items": [
    {
      "id": "since-then",
      "name": "Since Then",
      "lat": 3.1291,
      "lng": 101.6779,
      "area": "Bangsar",
      "category": "Thai",
      "halal_status": "unknown",
      "price_band": "rm25_50",
      "distance_km": 0.4,
      "heat": "high",
      "good_count": 18,
      "bad_count": 2,
      "good_pct": 90,
      "mention_count": 3,
      "thumbnail_url": "https://xyzco.supabase.co/storage/v1/object/public/places/since-then.jpg",
      "latest_mention": { "handle": "@nomnomswithta", "quote": "Tom yum is the must-order. Comfort repeat." }
    },
    {
      "id": "gepuklah-by-mingchuun",
      "name": "Gepuklah By Mingchuun",
      "lat": 3.1370,
      "lng": 101.6180,
      "area": "Damansara Jaya",
      "category": "Indonesian",
      "halal_status": "unknown",
      "price_band": "under_rm10",
      "distance_km": 3.9,
      "heat": "medium",
      "good_count": 5,
      "bad_count": 4,
      "good_pct": 56,
      "mention_count": 2,
      "thumbnail_url": "https://xyzco.supabase.co/storage/v1/object/public/places/gepuklah.jpg",
      "latest_mention": { "handle": "@nomnomswithta", "quote": "Mixed verdict: worth trying, not worth the queue." }
    },
    {
      "id": "two-fold-coffee",
      "name": "Two Fold Coffee",
      "lat": 3.0930,
      "lng": 101.5860,
      "area": "Kelana Jaya",
      "category": "Cafe",
      "halal_status": "muslim_owned",
      "price_band": "under_rm10",
      "distance_km": 4.8,
      "heat": "low",
      "good_count": 6,
      "bad_count": 1,
      "good_pct": 86,
      "mention_count": 1,
      "thumbnail_url": "https://xyzco.supabase.co/storage/v1/object/public/places/two-fold-coffee.jpg",
      "latest_mention": { "handle": "@nomnomswithta", "quote": "Shio pan; eat hot. Repeat visitor, near home." }
    }
  ],
  "fallback": null
}
```

`good_pct` is `null` below 5 ratings — render "Baru — not enough ratings yet," not "0%" or a hidden meter. If `fallback: "kl_trending"` comes back, the items are still real KL places (city-wide, not empty) — render them the same way, no special empty state.

### Nearby list (`discovery.html`)

Same call as home, same response — **no separate endpoint and no filter query params.** The mock's `halal`/`non` filter chips, and any `q=`/`sort=` you might reach for, are **client-side filters over the `items` array already returned**, not request params:

- Halal chip: filter client-side on `halal_status` (`jakim_certified`/`muslim_owned`/`pork_free` vs `non_halal`/`unknown`) — do not send `?halal=true`.
- No search box, no sort dropdown in MVP — the array already arrives sorted `distance_km ASC, mention_count DESC`.

**Change from the mock:** `discovery.html` currently filters on a boolean `p.halal`. Swap to the `halal_status` enum (5 values, not a boolean) and update the chip labels/logic accordingly — `unknown` renders plainly, never as "Non-halal."

Save/unsave stays exactly as the mock has it — `localStorage` only, no server call (`saves` is deferred, see Parked below).

### Place profile (`place.html`)

| Action | Method | Path | Notes |
|---|---|---|---|
| Detail | GET | `/places/:id` | Address, hours, price band, photo, `my_vote`. |
| Mentions | GET | `/places/:id/posts` | Instagram posts, newest first, rendered as tap-to-load embeds. |
| Directions | client | — | Waze primary, Google Maps secondary (URL formats below). |

**Request / response** (copied from `BACKEND_REQUIREMENTS.md` §8.3):

```
GET /places/since-then
```

```json
{
  "id": "since-then",
  "name": "Since Then",
  "lat": 3.1291,
  "lng": 101.6779,
  "area": "Bangsar",
  "category": "Thai",
  "halal_status": "unknown",
  "price_band": "rm25_50",
  "heat": "high",
  "good_count": 18,
  "bad_count": 2,
  "good_pct": 90,
  "mention_count": 3,
  "thumbnail_url": "https://xyzco.supabase.co/storage/v1/object/public/places/since-then.jpg",
  "latest_mention": { "handle": "@nomnomswithta", "quote": "Tom yum is the must-order. Comfort repeat." },
  "address": "12, Jalan Telawi 3, Bangsar, 59100 Kuala Lumpur",
  "name_aliases": ["Since-Then Bangsar"],
  "hours_note": "Daily 11am–10pm, closed Mon (per Google, unverified)",
  "photo_url": "https://xyzco.supabase.co/storage/v1/object/public/places/since-then.jpg",
  "photo_credit": "@nomnomswithta via Instagram",
  "provider_place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "my_vote": "good"
}
```

`thumbnail_url` and `photo_url` are the same photo under two field names (list-card vs. hero image) — render one `<img>`, not two. Either can be `null` (photo hidden, or none seeded yet) — fall back to a placeholder, never a broken image.

**Posts (mentions):**

```
GET /places/gepuklah-by-mingchuun/posts
```

```json
{
  "items": [
    {
      "id": "post-DcBF0CLTQPH",
      "platform": "instagram",
      "post_url": "https://www.instagram.com/p/DcBF0CLTQPH/",
      "thumbnail_url": "https://xyzco.supabase.co/storage/v1/object/public/posts/DcBF0CLTQPH.jpg",
      "media_kind": "reel",
      "posted_at": "2026-08-14T00:00:00+08:00",
      "is_sponsored": false,
      "content_summary": "INDEPENDENT source for Gepuklah. Mixed verdict: worth trying, not worth the queue.",
      "creator": {
        "id": "nomnomswithta",
        "handle": "@nomnomswithta",
        "display_name": "Ta",
        "avatar_url": "https://xyzco.supabase.co/storage/v1/object/public/creators/nomnomswithta.jpg"
      }
    }
  ]
}
```

**Rendering a post — this is new, the current `place.html` mock has no embed at all:**

- Show `thumbnail_url` as a static card first — **tap-to-load**, don't auto-embed every post on page load.
- On tap, replace the card with the official Instagram embed (`<iframe>` / Instagram's embed script) built from `post_url`. Never fetch or render video from `thumbnail_url` or any other URL — only the official embed plays video.
- `media_kind` sizes the tapped-in embed: `reel` → tall/9:16 frame, `post` → square/4:5 frame.
- `is_sponsored: true` → show a small "Sponsored" tag on the card; don't hide the post.
- Only `platform: "instagram"` posts render this way in MVP — the schema allows `tiktok`/`youtube`/`other` for future creators, but there is no embed path for them yet. If one shows up in a response, render its `thumbnail_url` card with an "Open original" link to `post_url` and skip the tap-to-embed step.

**Directions deeplinks** — replace `place.html`'s current `google.com/maps/search?query=<name>+<address>` text search with place-id-aware links:

- Waze (primary — always available): `https://waze.com/ul?ll=<lat>,<lng>&navigate=yes`
- Google Maps, when `provider_place_id` is present: `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>&query_place_id=<provider_place_id>`
- Google Maps, when `provider_place_id` is `null`: `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`

`404` on `GET /places/:id` (unknown id, or place not yet published) → show a "This place isn't on BiteMap yet" state, not a broken page.

### Rate (`rate.html`)

| Action | Method | Path | Body | Auth |
|---|---|---|---|---|
| Submit | POST | `/places/:id/ratings` | `{ "type": "good" \| "bad" }` | required |
| Mine | GET | `/places/:id/ratings/me` | — | required |

**Submit:**

```
POST /places/since-then/ratings
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{ "type": "good" }
```

```json
{ "good_count": 19, "bad_count": 2, "good_pct": 90, "my_vote": "good" }
```

**Second vote (locked):**

```json
{ "error": { "code": "VOTE_LOCKED", "message": "You already rated this place." } }
```

**Change from the mock:** `rate.html` currently writes the vote straight into `localStorage` (`session.votes[placeId]`) with no lock check — the toggle just switches between Good/Bad freely. Real behavior: submit once, `POST` locks it server-side; on `409 VOTE_LOCKED` (or by reading `GET /places/:id/ratings/me` on page load), render the rating as already-cast and **disable the toggle**, don't let the user "change their mind" client-side. No geo/visit proof is checked — this stays honor-system, and no UI copy should say "verified."

**Mine (to decide toggle state on load):**

```json
{ "type": "good" }
```

or `404` with `{ "error": { "code": "RATING_NOT_FOUND", "message": "You haven't rated this place yet." } }` — treat `404` here as "show the toggle, unlocked," not an error state.

### Me (`me.html`)

| Action | Method | Path | Notes |
|---|---|---|---|
| Profile | GET | `/me` | |
| Logout | — | Supabase JS client (`supabase.auth.signOut()`) | No custom `/auth/logout` route. |
| Stats | — | client-only | `votes`/`saved` counts stay computed from `localStorage`, same as the current mock — there is no `/me/stats` endpoint in MVP. |
| Settings (push, theme) | — | client-only | Unchanged from the mock. |

```json
{
  "id": "6f2b6e0a-8c31-4e1a-9c3d-7a2e5f9b0c11",
  "email": "amir.hakim@gmail.com",
  "display_name": "Amir Hakim",
  "last_city": "KL",
  "role": "user",
  "created_at": "2026-08-20T14:03:11+08:00"
}
```

`401` → the FE should already have redirected to `login.html` before this ever renders; treat it as an expired-session signal if it does show up.

---

## Parked (not deleted)

These screens/features stay in the repo, unwired, for when their tables come back (see `BACKEND_REQUIREMENTS.md` §7 Deferred):

| Screen / feature | Deferred as |
|---|---|
| `follow.html` | Follow onboarding — no `follows` table or `/me/following/*` route in MVP. |
| `influencers.html` | Creator directory / leaderboard — no `/creators` or `/creators/leaderboard` route in MVP. |
| `influencer.html` | Creator profile — no `/creators/:id` route in MVP. |
| Save button (`discovery.html`, `place.html`) | Stays `localStorage`-only — no server `saves` table or `/me/saves/*` route in MVP. |

Do not remove these files or their nav entries as dead links — they're future screens, not cut ones. If the nav needs to hide them from the MVP tab bar, that's a nav-config change, not a file deletion.

---

## Local dev fixture

Before the real API exists, develop against `seed/fixtures/nomnomswithta.json` (see `seed/fixtures/README.md`) rather than `js/mock.js`'s invented places — it's real hand-curated KL data (Two Fold Coffee, Since Then, Gepuklah By Mingchuun, and the rest of `@nomnomswithta`'s mapped places), shaped to match the endpoint responses above **field-for-field**, so swapping the fixture for a real `fetch()` later needs zero reshaping.

Its top-level keys: `places_nearby` (an array shaped exactly like `/places/nearby`'s `items`), `place_detail` (a map of place id → the `/places/:id` shape), and `place_posts` (a map of place id → the `/places/:id/posts` shape). Coordinates in the fixture are area-centroid placeholders (Bangsar, Damansara Jaya, Kelana Jaya, …) — none of the source posts had a matched Google Place ID yet, so treat `lat`/`lng` as illustrative, not surveyed.

---

## Out of scope for these screens

Video hosting, live scrapers, visit geofencing, claim admin UI, follows/leaderboard, server-side saves, credibility scoring, share cards, multi-city, email OTP login.

---

## Suggested build order

1. Supabase Auth (Google) + `GET /me`.
2. `GET /places/nearby` → wire `home.html` (with the `heat` → chili/mango/lime mapping) and `discovery.html` (client-side filters only).
3. `GET /places/:id` + `GET /places/:id/posts` → `place.html`, including the tap-to-load Instagram embed and the Waze/Maps deeplinks.
4. `POST /places/:id/ratings` + `GET /places/:id/ratings/me` → `rate.html`, with real lock/409 handling.
5. Swap `seed/fixtures/nomnomswithta.json` for live `fetch()` calls once the API is deployed.
