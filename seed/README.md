# Seed data

Hand-curated launch inventory, collected 30/08/2026 from public Instagram post pages (logged out). Maps onto the §11 data model.

| File | Rows | Table |
|---|---|---|
| `creators.csv` | 5 | `creators` |
| `platform_accounts.csv` | 5 | `platform_accounts` |
| `places.csv` | 27 | `places` |
| `posts.csv` | 45 | `posts` |
| `_raw_ig_sample.csv` | 45 | provenance — the raw extraction these were derived from |

## What is and isn't filled in

**Filled:** creator identity, handles, follower snapshots, post URLs, timestamps, `is_sponsored`, place names and areas, `total_mentions`, and a `content_summary` per post.

**Deliberately empty:**

- `provider_place_id`, `location`, `address` — no Places lookup has been run. Every place still needs matching before it can rank or show a distance.
- `credibility_score`, `weighted_rank`, `sentiment_score` — derived, not seeded.
- `category` — left blank rather than guessed.

**Two non-schema columns on `posts.csv`**, kept because they cost nothing and would be expensive to recover: `resolved_by` (which signal identified the place) and `location_tag_kind` (whether the tag named the venue, an area, an event, or a relative description). Drop them at import if unwanted.

## How the 45 posts break down

27 are genuine venue visits; 18 are not — 7 sponsored, 6 self-interest, 2 personal, 2 out-of-scope, 1 not-a-restaurant. Excluded posts are kept with `ingest_status = excluded:<reason>` and a null `place_id`, so the exclusion is auditable rather than invisible.

Of the 27 venue posts, 22 were resolved by the Instagram location tag alone or in combination — **81%**. Three were resolvable only from hashtags, one only from an @-mention, one not at all.

## Per-creator yield varies enormously

| Creator | Venue posts / sampled |
|---|---|
| `@nomnomswithta` | 10 / 10 |
| `@jajabinxz` | 8 / 11 |
| `@jcinthehizzay` | 5 / 7 |
| `@tomato_ate_it` | 4 / 11 |
| `@mingchuun` | **0 / 6** |

`@mingchuun` owns Gepuklah and every sampled post was about his own venue. He is kept in `creators.csv` with that recorded in `seed_score_notes`, but no place in this seed comes from him. Gepuklah itself is present — sourced from `@nomnomswithta`, who visited independently and gave it a mixed verdict.

## Known edge cases in `places.csv`

- **Two unnamed venues.** A kelapa laut stall tagged only *"Same lane as Roti Jane, Seksyen 7"*, and a claypot rice place whose post gives two branch addresses but never a name.
- **One pop-up.** "Sweets by Baby" was a stall at a Shah Alam food fest, not a permanent venue.
- **Outside the KL/PJ core:** Bangi, Shah Alam. Filter before launch if the coverage area is narrower.

## Halal

Not populated. Several captions carry the creator's own wording — *"Muslim Friendly"*, *"(No Pork No Alcohol)"* — and one venue serves Guinness. These are preserved verbatim in `content_summary` and `seed_note` as claims by the creator, never as a verified status.

## Caveats

Sampled from the ~12 most recent posts per creator that a logged-out fetch exposes; deeper history needs an authenticated session. Roughly 30% of post fetches returned empty shells and were retried or skipped — 14 shortcodes remain uncollected. Follower counts are single snapshots and differ between sources.
