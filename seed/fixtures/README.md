# FE dev fixtures

Local, static stand-ins for the real API, shaped **field-for-field** to `frontend/BACKEND.md` / `BACKEND_REQUIREMENTS.md` §8, so a screen wired against a fixture swaps to a real `fetch()` later with zero reshaping.

## `nomnomswithta.json`

One creator, `@nomnomswithta`, all 10 of her matched (`ingest_status = matched`, non-sponsored-excluded) venue posts and their 10 distinct places — the single best-yield creator in `seed/*.csv` (10/10 sampled posts were genuine venue visits, per `seed/README.md`'s per-creator yield table). One creator keeps the fixture small while still exercising every screen: home map, nearby list, place profile, and mentions.

Built by hand from `seed/creators.csv`, `seed/platform_accounts.csv`, `seed/places.csv`, and `seed/posts.csv` — filtering `posts.csv` to `creator_id = nomnomswithta` and `ingest_status = matched`.

### Top-level shape

```json
{
  "_meta": { ... },
  "places_nearby": { "items": [ ... ], "fallback": null },
  "place_detail": { "<place-id>": { ... }, ... },
  "place_posts": { "<place-id>": { "items": [ ... ] }, ... }
}
```

- `places_nearby` — the literal `GET /places/nearby` response body (all 10 places; a real query would radius-filter, this fixture just includes all of them since there's only one creator's worth of data to serve).
- `place_detail` — keyed by place id, each value the literal `GET /places/:id` response body.
- `place_posts` — keyed by place id, each value the literal `GET /places/:id/posts` response body (one post per place here, since it's a single-creator fixture — a real place can have more).
- `_meta` — not part of any real endpoint; fixture-only bookkeeping, see below.

### What's real vs. placeholder

**Real, from the seed:** place names, areas, post URLs, post timestamps, `is_sponsored`, `content_summary` (copied from `posts.csv`), creator handle/display name.

**Never invented — left `null`/`"unknown"` exactly as the seed has nothing:**
- `halal_status`: always `"unknown"` — even where a post's caption claims "Muslim Friendly" or "No Pork No Alcohol" (none of this creator's 10 posts happen to carry such a claim, but the rule holds regardless): `halal_status` is never inferred from a caption, per `BACKEND_REQUIREMENTS.md` §9.
- `price_band`, `category`, `address`, `name_aliases`, `hours_note`, `photo_url`/`thumbnail_url`, `photo_credit`, `provider_place_id`, `avatar_url`: `null` — none of this is in the seed CSVs.
- `my_vote`: `null` on every place — the fixture has no signed-in user baked in; treat every place as unrated-by-me (same as a guest session, or a fresh account).
- `good_count`/`bad_count`: `0`, `good_pct`: `null` — no `user_ratings` in the seed at all.
- `mention_count`: `1` on every place — one creator, one post per place. (A real place can have more; don't hardcode "1" as a UI assumption.)

**Two places have no `area` in `seed/places.csv`** (`don-t-tell-mama`, `lai-foong-lala-noodle` — blank in the source row, not a transcription slip). No area means no centroid to place them at, so both get `lat: null, lng: null, area: null, distance_km: null` rather than a guessed location. They still appear in `places_nearby.items`, sorted after every place that does have a distance (see Sort order below) — this is a deliberate edge case, useful for testing that the FE doesn't crash on a nearby item with no coordinates (e.g. a map pin that can't be placed, or a list card that should still render without a distance chip).

### Coordinate placeholders — read before using elsewhere

**These coordinates are illustrative placeholders for local FE layout and testing only. Never import them into a production dataset.** `seed/places.csv` has no `lat`/`lng` for any place — no Google Place match has been run yet (see `seed/README.md`). Every non-null coordinate below is an **area centroid**, not a surveyed venue location; two places in this fixture end up a plausible-looking distance from each other purely because their areas are close, not because anyone confirmed where the venue actually sits.

Centroid table used (4 decimal places; `since-then`, `gepuklah-by-mingchuun`, and `two-fold-coffee` reuse the exact coordinates already given as worked examples in `BACKEND_REQUIREMENTS.md` §8.2, so this fixture stays consistent with the contract doc; the rest are ordinary well-known area centroids):

| Area | lat | lng |
|---|---|---|
| Bangsar | 3.1291 | 101.6779 |
| Damansara Jaya | 3.1370 | 101.6180 |
| Kelana Jaya | 3.0930 | 101.5860 |
| TRX | 3.1421 | 101.7169 |
| Sri Hartamas | 3.1631 | 101.6511 |
| Steppes Mont Kiara | 3.1698 | 101.6509 |
| Kepong | 3.2149 | 101.6349 |
| PJ (Petaling Jaya) | 3.1073 | 101.6067 |

### Reference point and `distance_km`

`_meta.reference_point` is the KL centroid `(3.1390, 101.6869)` — the same fallback point `BACKEND_REQUIREMENTS.md` §3/§8.2 uses when a query's `lat`/`lng` falls outside the KL bounding box. `distance_km` on every place with coordinates is the haversine distance (§8.2's exact formula) from that reference point to the place's centroid, rounded to one decimal. This is **not** the same query point as the worked examples in `BACKEND_REQUIREMENTS.md` §8.2 (`3.1287, 101.6788`), so don't expect this fixture's `distance_km` values to match those examples' `0.4`/`3.9`/`4.8` even for the three places that share the same coordinates — different reference point, different distance.

### Sort order

`places_nearby.items` is ordered `distance_km ASC, mention_count DESC`, exactly as `/places/nearby` returns it. Since every place here has `mention_count: 1`, the tie-break never fires in practice — the order is pure ascending distance. The two places with no coordinates (`distance_km: null`) sort last, in place-id order (a stable, arbitrary tie-break — Postgres's default `NULLS LAST` for `ASC` is the behavior this mimics).

### `heat`

Computed by the rule in `BACKEND_REQUIREMENTS.md` §3/§5.8 (`high` if ≥2 non-self-interest posts in the last 14 days, `low` if the newest post is older than 30 days, else `medium`), applied to each post's real `posted_at` against `_meta.generated_at` (`2026-08-30`) as "now." No place in this fixture reaches `high` — that requires 2+ posts on the same place within 14 days, and every place here has exactly one (single-creator fixture).

### `media_kind`

Derived from the post URL path: `/reel/` → `"reel"`, `/p/` → `"post"`. All 10 of `@nomnomswithta`'s matched posts in `seed/posts.csv` happen to use `/p/` URLs, so `media_kind` is `"post"` throughout this fixture — that's a fact about this creator's posting habits, not a fixture simplification; a different creator's fixture could well contain reels.

### How the FE swaps this for the real API

1. While building, `import` or `fetch()` this file locally and read `places_nearby`, `place_detail[id]`, `place_posts[id]` in place of the three endpoint calls.
2. When the real API is up, replace those three reads with `GET /places/nearby`, `GET /places/:id`, `GET /places/:id/posts` respectively — same field names, same nesting, so no response-shaping code needs to change, only the data source.
3. Drop `_meta` — it isn't a real API field. Don't write any component code that reads `_meta` at render time; treat it as fixture-only metadata (it's there so a human opening the file knows how it was built and that the coordinates aren't real).
