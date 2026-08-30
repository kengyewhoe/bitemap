# Seed Playbook

This is the seeding process. There is no scraping pipeline — this manual, creator-by-creator triage
*is* the ingestion system, not a stopgap until one is built. It writes into the schema at
`BACKEND_REQUIREMENTS.md` §5, via the Supabase Studio table editor, per §10. `seed/README.md` and
`seed/creators.csv` are the evidence base for every rule below — the numbers are cited, not invented.

Tables, in FK order: `creators` → `platform_accounts` → `places` → `posts`. `seed/*.csv` is the raw
research record behind this playbook and is never rewritten or deleted — new work goes into
Supabase directly, not back into those files.

## 0. Before you touch a row

- Seed with the `service_role` key (bypasses RLS) in Supabase Studio's table editor — no admin UI, per the MVP cut.
- Work one creator at a time, start to finish (steps 1–4 below), rather than batching by table.
- If in doubt about a column's shape, `BACKEND_REQUIREMENTS.md` §5.1–§5.6 is the source of truth for enums and types; this file tells you what to type into them, not what they're called.

## 1. Intake triage — classify before you sample a single post

`content_type` is set the moment you land on the profile, before reading any posts. It decides
whether step 2 happens at all.

| `content_type` | Rule | Evidence |
|---|---|---|
| `venue_reviewer` | The only seedable type. Proceed to §2. | — |
| `venue_reviewer` + `is_operator = true` | Keep the creator row. Never create a `places` row from their own-venue posts — mark those posts `is_self_interest = true` instead, which excludes them from `mention_count` without deleting them. | `@mingchuun`, 127K followers: 0 of 6 sampled posts were third-party — all six were his own restaurant, Gepuklah. |
| `venue_reviewer`, sponsored-heavy | Still seedable. Skip sponsored posts (`excluded:sponsored`); expect low yield and say so in `seed_score_notes`. | `@tomato_ate_it`: 4 of 11 sampled posts were genuine venue visits; 7 were brand deals or personal. Format drifted toward sponsored over time. |
| `recipe` / `travel` / `media_brand` / `photographer` | Record the `creators` row (for completeness and so it's never re-triaged), set `is_active = false`, seed zero places. | 5 of 11 top-ranked Malaysian food IG accounts review no venues at all — one of them with 4.4M followers (SPEC_V1 §8). Follower count is not a proxy for seedability. |

Set `is_operator` on sight if the bio names a restaurant they run, or a post reads like day-to-day
shop management rather than a visit — don't wait for the pattern to repeat across 6 posts before
flagging it.

## 2. Per-account workflow (for anything triaged `venue_reviewer`)

1. **Check link-in-bio for a public Google Maps list first.** Roughly 1 in 4 accounts publish one —
   names, addresses and coordinates already resolved by the creator, for free (SPEC_V1 §8). There is
   no `maps_list_url` column in the current schema (it didn't make the MVP fold-in list), so this
   isn't something you store — it's a shortcut you work through immediately: each list entry still
   goes through place-lookup-first (step 3) exactly like a post-derived one.
2. **Sample recent posts logged out.** A logged-out fetch exposes roughly the 12 most recent. About
   30% of fetches return empty shells — retry once, then skip and move on; don't burn more than one
   retry per post. Deeper history needs an authenticated session, which is out of scope (§4).
3. **Place-lookup-first, always.** Before creating a `places` row, search existing rows by name,
   `name_aliases`, and area for a match. This is the entire point of the model, not a nicety:
   venue-first seeding quietly creates duplicate rows for the same stall and throws away the
   corroboration signal that a second independent creator gives a place.
   - **Found** → add a `posts` row with `place_id` set. That place's `mention_count` just went up
     honestly.
   - **Not found** → create the `places` row first (name, area, `halal_status`, `price_band`,
     `hours_note` if you have real signal — see step 5 on never guessing these), then the `posts` row.
4. **Resolve the place, in this order** (rates observed across the 27 genuine venue posts in the
   sample):
   | Signal | Observed rate | Note |
   |---|---|---|
   | IG location tag names the venue | 81% (alone or combined with another signal) | Fastest path — check this first every time. |
   | Hashtags | ~11% (3 of 27) | Venue identity lives only in tags like `#koppiku #universitimalaya` — no location tag, no caption name. |
   | @-mention of the venue's own account | ~4% (1 of 27) | E.g. `@meatheavenkl` tagged with no location tag and no venue name in the caption. |
   | Unresolvable | ~4% (1 of 27) | Flag `ingest_status = needs_match` (or skip) rather than guessing a place. |
   A location tag can also be a relative description ("Same lane as Roti Jane, Seksyen 7") rather
   than a venue name — treat that as a hard case, not a resolved one; confirm the actual venue
   before creating a row.
5. **Every non-venue post still gets a row** with `ingest_status = excluded:<reason>` and
   `place_id = null`, so the exclusion is auditable rather than invisible. Reasons seen in the
   sample, roughly in order of frequency: `sponsored` (7), `self_interest` (6), `personal` (2),
   `out_of_scope` (2, e.g. a Shanghai or Sabah trip), `not_a_restaurant` (1, e.g. a farmstay). A post
   can carry two reasons (`excluded:out_of_scope+sponsored`) — record both.
6. **Write `content_summary` as a one-line pull-quote** drawn from the caption — this is what
   `place_cards.latest_mention_quote` renders on the card. Keep the creator's own colour ("pricey
   but yumz", "would return to work/chill") rather than flattening it into a generic line.
7. **Never infer `halal_status` or `price_band`.** Default `halal_status = unknown`; leave
   `price_band` null unless the post states an actual price. A creator's own wording — "Muslim
   Friendly", "(No Pork No Alcohol)" — is a quoted claim, not a verified status: keep it verbatim in
   `content_summary`, never translate it into `halal_status = muslim_owned` or `pork_free` yourself.
   Only JAKIM-certification you can independently confirm justifies `jakim_certified`.

## 3. Media handoff

- Download the photo and avatar bytes and upload them to Supabase Storage; `places.photo_url` and
  `creators.avatar_url` point at that copy, never at the original CDN URL — those expire.
- Fill provenance alongside every upload: `photo_source` (`influencer_post` for a scraped IG post
  image, `google_places` / `own` / `licensed` for the alternatives), `photo_source_url` (original
  CDN URL, kept for provenance only, never served to the FE), `photo_credit`, `photo_fetched_at` —
  and the equivalent `avatar_source_url` / `avatar_fetched_at` for the creator row.
- `photo_visible = false` is the kill switch for a photo that turns out wrong or unlicensed — flip
  it in the table editor, don't delete the row. `place_cards` (§5.8) hides `photo_url`/`photo_credit`
  automatically whenever it's set.
- Google Places photos and scraped Instagram post images sit on different licensing terms —
  `photo_source` is what keeps them on separate code paths. Confirm current Google Places photo
  terms before launch.
- Posts themselves are never rehosted. The detail screen renders the official Instagram embed
  straight from `post_url`, tap-to-load — no media capture step for posts, ever.

## 4. Boundaries

- Logged-out public pages only. Never authenticate a collector account — this stays true even after
  automation is revisited post-MVP.
- Store public post URLs and handles only. No scraped personal data (PDPA) — if a caption exposes a
  third-party phone number or similar, that detail is left out of `content_summary` entirely.
- KL metro scope. Filter out anything clearly outside coverage (the sample includes Bangi and Shah
  Alam) before publishing, or note it in `seed_note` if you're keeping it in `draft` for a future
  wider launch.
- **Targets:** 80–150 published `places`, across roughly 30–50 creators. Track yield per creator —
  it varies enormously and that variance is the normal case, not a signal something went wrong:

  | Creator | Venue posts / sampled |
  |---|---|
  | `@nomnomswithta` | 10 / 10 |
  | `@jajabinxz` | 8 / 11 |
  | `@jcinthehizzay` | 5 / 7 |
  | `@tomato_ate_it` | 4 / 11 |
  | `@mingchuun` | 0 / 6 |

- Flip `places.status` to `published` only once `name`, `lat`/`lng`, `area`, and `halal_status` are
  filled (default `unknown` counts as filled — it's never blank) and a photo exists. A place can sit
  in `draft` indefinitely if a photo hasn't been sourced yet; that's a queue, not a failure.

---

Done when: handed an unknown Instagram account, you can classify its `content_type` in under a
minute, know immediately whether to sample its posts at all, and — if you do — know what every
post's `ingest_status` should end up as before you've made a single `places` row.
