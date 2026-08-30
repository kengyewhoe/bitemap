# Seed data

Hand-curated launch inventory, collected 30/08/2026 from public Instagram post pages (logged out). The CSV headers match the schema in [`BACKEND_REQUIREMENTS.md`](../BACKEND_REQUIREMENTS.md) §5 (the binding MVP schema) column-for-column, and [`../supabase/seed.sql`](../supabase/seed.sql) is generated from these rows.

**Loading:** `supabase db reset` applies migrations then `supabase/seed.sql` automatically (`config.toml` `[db.seed]` already points at it). No table-editor work is needed for this batch. If a CSV changes, regenerate `seed.sql` from it — the CSVs are the record, `seed.sql` is the derived loader.

See [`PLAYBOOK.md`](PLAYBOOK.md) for the manual triage-and-seed process this data was collected under — the process to repeat for every new creator going forward (new creators are seeded via the Supabase table editor per the playbook, not by editing these files).

For a static, API-shaped local dev fixture built from this data, see [`fixtures/README.md`](fixtures/README.md).

| File | Rows | Table |
|---|---|---|
| `creators.csv` | 5 | `creators` |
| `platform_accounts.csv` | 5 | `platform_accounts` |
| `places.csv` | 27 | `places` |
| `posts.csv` | 45 | `posts` |
| `_raw_ig_sample.csv` | 45 | provenance — the raw extraction these were derived from |

## What is and isn't filled in

**Filled from the research record:** creator identity, handles (normalized lowercase, `@` stripped, per §5.4), follower snapshots, `profile_url` (derived from handle), post URLs, `posted_at`, `is_sponsored`, `media_kind` (all 45 are `/p/` URLs → `post`), `ingest_status` + `excluded_reason` (split from the old `excluded:<reason>` values), `is_self_interest` (the 6 `@mingchuun` own-venue posts), place names and areas, and a `content_summary` per post.

**Filled where the row's own notes clearly support it, empty otherwise:**

- `content_type = venue_reviewer` on all 5 creators (each was triaged as one; see per-creator notes), `is_operator = true` on `@mingchuun` only.
- `halal_status = non_halal` on Makhan By Kitchen Mafia only (the venue's own Guinness collab). Everything else stays `unknown` — creator wording like "Muslim Friendly" / "(No Pork No Alcohol)" is never translated into a status, per PLAYBOOK.md.
- `price_band` on 4 places where a per-item/per-person price is stated (Sisters Place, KLCG, Hikiniku to Come, Meat Heaven KL). Left null where only a sharing-platter or appetizer price exists (Nale, Chilli's, Serdang stall) — the reasoning is in each row's `notes`.
- `hours_note` on the Serdang stall ("open till ~3am", creator-reported).
- `name_aliases = {Gepuklah}` on Gepuklah By Mingchuun.
- `operational_status = unknown` on the Sweets by Baby pop-up (the fest has ended); `operational` elsewhere.
- `status = draft` on every place — nothing has coordinates, and `places_published_has_coords` forbids publishing without them.

**Deliberately empty (never fabricated):**

- `lat`, `lng`, `provider_place_id`, `address` — no Places lookup has been run.
- `category` — left blank rather than guessed.
- `bio`, `maps_list_url`, `avatar_*`, `photo_*` provenance, `thumbnail_url`, `external_id` — not collected; media handoff is PLAYBOOK.md §3.

**Two non-schema columns on `posts.csv`**, kept because they cost nothing and would be expensive to recover: `resolved_by` (which signal identified the place) and `location_tag_kind` (whether the tag named the venue, an area, an event, or a relative description). `seed.sql` does not load them.

## Data gaps — needed before any place can be published

Human collection checklist; `places_published_has_coords` blocks publishing until at least the coordinates exist:

- [ ] **`lat`/`lng` for all 27 places** — hard blocker for `status = published`.
- [ ] **`provider_place_id`** (Google Place ID) via Places lookup — stays null forever only for venues Google doesn't list (the two unnamed stalls, the pop-up).
- [ ] **`address`** for all 27 places (KLCG's is recoverable from its caption; the claypot place has two — pick per-outlet handling first).
- [ ] **A photo per place** + provenance (`photo_source`, `photo_source_url`, `photo_credit`, `photo_fetched_at`) uploaded to Storage — PLAYBOOK.md §3; the playbook requires a photo before publishing.
- [ ] **`category`** per place — currently all blank.
- [ ] **Resolve the two unnamed venues and the multi-outlet claypot row** (real names / split into per-outlet rows) and decide whether out-of-area rows (Bangi, Shah Alam) stay `draft` or are dropped.
- [ ] **Avatars for the 5 creators** (`avatar_url` + provenance).
- [ ] **Verify halal status** where it matters — everything except Makhan is `unknown`.

## How the 45 posts break down

27 are genuine venue visits; 18 are not — 7 sponsored, 6 self-interest, 2 personal, 2 out-of-scope, 1 not-a-restaurant. Excluded posts are kept with `ingest_status = excluded`, the reason in `excluded_reason`, and a null `place_id`, so the exclusion is auditable rather than invisible.

Of the 27 venue posts, 22 were resolved by the Instagram location tag alone or in combination — **81%**. Three were resolvable only from hashtags, one only from an @-mention, one not at all.

## Per-creator yield varies enormously

| Creator | Venue posts / sampled |
|---|---|
| `@nomnomswithta` | 10 / 10 |
| `@jajabinxz` | 8 / 11 |
| `@jcinthehizzay` | 5 / 7 |
| `@tomato_ate_it` | 4 / 11 |
| `@mingchuun` | **0 / 6** |

`@mingchuun` owns Gepuklah and every sampled post was about his own venue. He is kept in `creators.csv` with `is_operator = true` and that history in `notes`, but no place in this seed comes from him. Gepuklah itself is present — sourced from `@nomnomswithta`, who visited independently and gave it a mixed verdict.

## Known edge cases in `places.csv`

- **Two unnamed venues.** A kelapa laut stall tagged only *"Same lane as Roti Jane, Seksyen 7"*, and a claypot rice place whose post gives two branch addresses but never a name.
- **One pop-up.** "Sweets by Baby" was a stall at a Shah Alam food fest, not a permanent venue.
- **Outside the KL/PJ core:** Bangi, Shah Alam. Filter before launch if the coverage area is narrower.

## Halal

`unknown` everywhere except Makhan By Kitchen Mafia (`non_halal`, from the venue's own Guinness collab). Several captions carry the creator's own wording — *"Muslim Friendly"*, *"(No Pork No Alcohol)"* — preserved verbatim in `content_summary` and `notes` as claims by the creator, never as a verified status.

## Caveats

Sampled from the ~12 most recent posts per creator that a logged-out fetch exposes; deeper history needs an authenticated session. Roughly 30% of post fetches returned empty shells and were retried or skipped — 14 shortcodes remain uncollected. Follower counts are single snapshots and differ between sources.
