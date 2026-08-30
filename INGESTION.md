# Influencer Venue Pipeline — Research & Proposal

> **Status:** Post-v1. Research complete, not scheduled.
> **Question:** How do we build a database of every restaurant an influencer has reviewed?
> **Date:** 30/08/2026 · Sample n=8 · Logged-out observation only

**Scope note.** None of this is v1 work. SPEC §2 cuts automated ingestion and §8 makes seeding manual by hand. This document specifies the deferred *venue resolution ladder* from SPEC §10, plus one thing worth logging during v1 seeding at zero engineering cost. Nothing here should pull an engineer-day away from the five rows in SPEC §2.

---

## 1. What we sampled, and what we found

The working assumption was that ingestion means reading captions. That survives, but it is no longer the first move. Two of eight sampled creators publish a **curated Google Maps place list** in their link-in-bio — names, addresses, coordinates and Place IDs already resolved, by the creator, for free.

The other six do not, and *why* they don't is the more useful finding.

| Account | Followers | What they actually are | Link in bio resolves to | Maps list |
|---|---|---|---|---|
| `@mingchuun` | 127K | Venue hunter — also a venue *operator* | `linktr.ee` → 3 Maps lists (KL, Hanoi, own shop) | **YES** |
| `@tomato_ate_it` | 50.9K | Venue hunter, "honest reviews only" | `linktr.ee` → "Reviewed by Tomato" | **YES** |
| `@eatdrinkkl` | ~58K | Review publication with its own venue directory | IG blocked; site has a `/venues` index | *other* |
| `@kl.foodie` | 1.6M | Ad-funded media company (Good Foodie Media Sdn Bhd) | `bit.ly` → a property expo campaign | no |
| `@foodilifecious` | 70K | F&B veteran, affiliate-monetised | `epos.com/my/referrals` | no |
| `@carol.eats` | 61.1K | Café hopper; indexes via `#carolcafehop` | none surfaced | no |
| `@euniceeunny` | 44.4K | Food photographer / stylist — reviews nothing | own studio site | no |
| `@syengg` | 10.9K | Travel + couple content, food secondary | YouTube + a Klook discount code | no |

### Finding 1 — the Maps list is real, but a minority surface

2 of 7 readable accounts, roughly 30%. Small sample, wide error bar. But the two who have one are not random: both are mid-tier personal curators in the 50–130K band whose whole identity is *"I go and I rank."* The ones without are a media company selling ad placements, two affiliate marketers, and a photographer. **The list is a by-product of being a genuine curator** — exactly the population BiteMap wants anyway.

### Finding 2 — most "top food influencers" review no venues at all

Of eleven Malaysian food creators in one widely-cited ranking, five are recipe and home-cook accounts (`@khairulaming` 4.4M, `@adikfoods` 1M, `@arianna.kitchen` 460K, `@masakwithpassion` 427K, `@sfs_kitchen` 312K) and one is Penang-only (`@penangfoodie` 1.6M, outside SPEC §2 scope). They produce no venue signal whatsoever.

Follower count is close to useless as a selection criterion — the 4.4M account contributes zero venues and the 50.9K account hands you a pre-resolved list. **SPEC §8 step 1 needs a filter, not a leaderboard.**

### Finding 3 — some creators are operators, and their posts aren't evidence

`@mingchuun` tried ayam gepuk at ~50 shops, concluded most served it dry, then spent his savings opening *Gepuklah*. His feed from late June to mid-August 2026 is almost entirely his own restaurant: opening countdowns, a `HIRING` highlight, a sambal pre-registration form.

Pull this creator's last 30 posts and you extract **one venue: his own.** That is not a sponsored post catchable with a `#ad` classifier — it is ownership, and it makes recency-weighted crawling actively misleading for anyone who has crossed into operating. A venue appearing only in its owner's posts must not enter the list on that evidence; it needs a second, independent creator.

---

## 2. Proposed architecture: four tiers, ranked by precision

Every tier emits the same thing — a `venue_candidate` row — and they run in order of falling precision. A creator is worked top-down until their venues are covered, so you only pay for the expensive tiers on the creators the cheap ones miss.

### Tier A — Curated exports
*~30% of creators · precision ≈ 1.0 · cost: minutes*

The creator's own Google Maps place list, or a publication's own venue directory. Already carries name, address, coordinates and a **Google Place ID** — literally the `venues.google_place_id` field SPEC §4 defines for the Maps deeplink. No location tag, no LLM, no fuzzy matching, no confidence score.

*Caveats.* A guide is a curated **subset** — high precision, unknown recall. It carries no dates and no post URLs, so it gives you a `venues` row but not the `recommendations` row SPEC §3.3 "Why it's here" needs; those still get paired back to posts. And Maps place lists render entirely in JavaScript — a logged-out fetch returns a 35KB shell with zero Place IDs, so extraction needs a real browser render.

### Tier B — Self-indexed archives
*~25% of creators · precision high · cost: low*

Creators who index their own work without a Maps list: a personal hashtag (`#carolcafehop`, maintained since 2014), or story highlights grouping venues by city or theme — `@tomato_ate_it` keeps `KL`, `Top rated` and `FOOD GUIDE`; `@syengg` keeps `Food reviews`.

These don't resolve a venue by themselves, but they hand you a **pre-filtered, creator-endorsed post set**, which makes Tier C far cheaper and higher-yield than crawling a whole feed.

*Caveats.* Highlights expire and get re-cut. A discovery aid for Tier C, never a venue source on its own.

### Tier C — Post-level extraction
*the general case · precision variable · cost: real*

The original ladder, unchanged, and still necessary — the only tier that works for everybody. Run per post, stop at the first hit:

- **C1 · Location tag** — the post's metadata field, not the caption. Facebook Places entry → name + coordinates. Noisy: duplicate entries, wrong branch, and it frequently tags the *mall* rather than the stall.
- **C2 · @-mention of the venue's own account** — the strongest and most stable signal available. A handle is a durable venue key; a name string is not. Resolve the mentioned account → bio address → link-in-bio.
- **C3 · Caption text (LLM)** — name, area, branch hints (*"outlet SS15"*, *"sebelah 7-Eleven"*). Off-the-shelf NER fails on Malay–English–Chinese code-mixing; needs a Malaysian-tuned prompt seeded with the SPEC Appendix A cuisine vocabulary.
- **C4 · OCR on the image** — underrated. Most KL food posts include a shopfront frame, and the signboard usually carries the Chinese name *and* its romanisation. A direct feed into `venues.name_aliases`.

*Caveats.* The "45–55% of posts carry a location tag" figure is an **estimate** — nothing in this sample confirmed it, because logged-out Instagram returns profile headers without post-level metadata. Measure it in Phase 0 before sizing anything on it.

### Tier D — Human review
*the floor · never removed*

Everything ambiguous lands in a queue with the top three Places candidates pre-filled. Per SPEC §11, the founder staffs it. The queue is the only path to `is_published = true`, and it never goes away — automation changes how much reaches it, not whether it exists.

### The governing principle

**Optimise precision, not recall.** A missed post is invisible to users. A wrong venue is someone driving 25 minutes down the Federal Highway to the wrong shop — the exact trust failure SPEC §9 is built to prevent. Dropping 20% of posts is fine. A 5% wrong-venue rate is not.

This is what makes the tiering work: resolution accumulates **per venue**, not per post. A place unresolvable from one caption is usually resolvable from another creator's post about it next month.

---

## 3. Schema

> **Reconciled with SPEC, 30/08/2026.** This section was written against a draft where `venue_posts.influencer_handle` was a plain string and influencer records were deferred. SPEC now ships `influencers` and `recommendations` as v1 tables, which resolves most of what follows. **Only `influencer_venues` and `venue_candidates` remain to be added** — and `influencer_venues` may collapse into `recommendations` entirely once Tier A imports need a row with no post behind them. SPEC also pulled `content_type`, `is_operator`, `operator_venue_id` and `maps_list_url` forward into v1 (per the Phase 0 argument in §4), so the `influencers` block below is kept only for the three columns v1 still lacks: `personal_hashtag`, `best_tier`, `last_crawled_at`.

A per-influencer venue database needs the influencer to be a row, not a string. Three tables described here; `venues` is untouched.

```
-- ALREADY SHIPS IN V1. Do not create — see SPEC 4 `influencers`.
-- Listed here only for the three columns v1 does not yet carry.
influencers
  ...                             -- v1 already has: id, handle, platform,
                                  -- display_name, follower_count, is_active,
                                  -- content_type, is_operator, operator_venue_id,
                                  -- maps_list_url, avatar_* (SPEC 4.4)
  personal_hashtag  text null     -- ADD. Tier B source, e.g. '#carolcafehop'
  best_tier         enum          -- ADD. A | B | C — cheapest tier that works
  last_crawled_at   timestamptz   -- ADD. Crawl bookkeeping, no v1 equivalent

-- the answer to "which restaurants has this influencer reviewed?"
-- LARGELY SUBSUMED by v1 `recommendations`, which already carries
-- influencer_id, venue_id, source_tier and is_self_interest. Build this
-- ONLY if Tier A imports need a row with no post behind them; otherwise
-- make `recommendations.post_url` nullable and use that table instead.
influencer_venues
  influencer_id     fk → influencers.id
  venue_id          fk → venues.id
  source_tier       enum          -- A | B | C1..C4 | D — provenance, always kept
  recommendation_id fk → recommendations.id null   -- null for Tier A imports
  sentiment         enum null     -- post-v1; do not populate at first
  is_self_interest  bool          -- true when the creator owns this venue
  first_seen_at     timestamptz
  unique (influencer_id, venue_id)

-- GENUINELY NEW. Staging: nothing reaches `venues` from here
-- without passing a threshold.
venue_candidates
  id                uuid pk
  influencer_id     fk → influencers.id
  source_tier       enum
  source_url        text          -- post permalink or Maps list URL
  raw_name          text          -- exactly as extracted, never cleaned in place
  raw_area          text null
  raw_lat / raw_lng double null
  google_place_id   text null     -- present and trusted for Tier A
  match_confidence  numeric       -- 0..1
  photo_source      enum null     -- SPEC 4.4 contract: carried through to the
  photo_source_url  text null     -- venues row, not backfilled by the scrape job
  review_status     enum          -- auto | queued | merged | rejected
  resolved_venue_id fk → venues.id null
```

### Matching and thresholds

Tier A candidates arrive with a Place ID and skip matching entirely. Everything else goes to Google Places Text Search, biased to Klang Valley, scored on: name similarity across romanisation variants (what `name_aliases` was reserved for in SPEC §4), distance between extracted coordinates and the Places result, venue-type agreement, and whether the creator's handle appears in the Places website field.

| `match_confidence` | Action | Reaches users? |
|---|---|---|
| ≥ 0.85 | Auto-create `venues` row, `is_published = false` | Only after a human flips it |
| 0.50 – 0.85 | Tier D queue, top-3 Places candidates pre-filled | Only after a human flips it |
| < 0.50 | Reject and log | Never |

**Two fields the pipeline may never write.** `halal_status` and `is_published` stay human-set at every confidence level, per SPEC §9 risks 1 and 2. There is no score high enough to infer halal status from a caption, and no crawler output that should reach a user without a person having looked at it.

---

## 4. Phasing

### Phase 0 — during v1, zero engineering cost

SPEC §8 already has a person inserting 150 venues by hand. Add two columns to that working sheet:

- the **post URL → venue** mapping (§8 implies this already — it is the labelled eval set the pipeline will be measured against)
- **which tier would have found it**: A / B / C1 / C2 / C3 / C4 / needed-a-human

Seconds per venue. In exchange you get real coverage numbers before writing any pipeline code. If Tiers A and B cover 70% of what matters, Tiers C3 and C4 may never need building — potentially the largest cost avoidance available here, and it costs nothing to find out.

Also record per creator: `content_type`, whether they have a Maps list, whether they're an operator. That is the `influencers` table, populated by hand, before it exists as a table.

### Phase 1 — first build

Influencer registry plus Tier A import. Ship the three tables. Build one headless-browser job that renders a Maps place list and emits candidates. Run it per creator on demand, not on a schedule — these lists change monthly at most.

Roughly 30% of creators covered at near-perfect precision, for a few days of work. Highest return in this document.

### Phase 2 — the general case

Tier C ladder plus review queue. Collector (logged-out, via a managed provider — see §5), then C1→C4 in order into `venue_candidates`, then the Places matcher and the Tier D queue UI. Build C1 and C2 first and measure; C3 and C4 only if Phase 0 data says they're needed.

### Phase 3 — only once volume justifies

Sentiment, sponsorship detection, credibility scores — the SPEC §10 influencer layer proper, including "Legit vs. Hype". Note that `is_operator` from Phase 0 already catches the worst conflict class without any classifier at all.

---

## 5. Constraints we should not design around quietly

**Instagram.** Hold the SPEC §10 line: **logged-out collection via managed providers only.** No authenticated scraper — the downside is account bans and a ToS breach, and the upside is marginal.

**Media.** SPEC §4.4 now settles this, and it settles it differently from the draft this document was written against. Venue photos and influencer avatars *are* scraped and self-hosted; that is an accepted risk with named mitigations (attribution via `photo_credit`, provenance in `*_source_url`, `photo_visible` as a one-flip takedown), not a prohibition. Posts themselves are still never rehosted — they render as official Instagram embeds.

Two consequences for the pipeline. First, every tier that produces a venue must also produce media provenance, so `venue_candidates` carries the `photo_source` / `photo_source_url` pair through to the `venues` row rather than leaving the scrape workstream to backfill it. Second, the open question SPEC §4.4 flags — whether Google's Places photo caching terms permit the same handling as a scraped post image — lands squarely on Tier A, since Tier A is the tier that sources from Places. **Resolve it before Phase 1 ships, not after.**

**Google Maps place lists.** This deserves a straight answer rather than a workaround. Programmatically scraping another user's Maps place list sits against Google's terms of service, and there is no public API for it. Two clean routes:

1. **Human-in-the-loop import.** A person opens the list and captures it once per creator. At 30 creators this is an afternoon, and it is unambiguously fine.
2. **Ask the creator.** At this scale a founder DM is realistic — and it converts a grey area into a partnership. It also opens the door to **licensed photography**, which under SPEC §4.4 is now worth more than it was: the media stance there is an accepted risk carrying mitigations, and a creator's permission removes the risk outright for that creator's venues. Same conversation, two problems solved.

Route 2 beats route 1 on every axis except speed. Recommend starting there, with the two creators who already have lists.

**PDPA.** Store public post URLs and handles, not scraped personal data. Keep `venue_candidates.source_url` so every venue's provenance is auditable and any creator asking to be removed can be honoured in one query.

---

## 6. What this report does not know

Stated plainly, because the numbers above will get quoted back:

- **n = 8, and one of those was blocked.** "~30% have a Maps list" is a signal, not a rate. Confirm across 30 creators during Phase 0.
- **No post-level data was observed.** Logged-out Instagram returned profile headers only — no captions, no location tags. Every C1–C4 coverage figure is an estimate.
- **The KL Food Guide contents are unread.** Maps place lists are fully JS-rendered; a logged-out fetch returns an empty shell. We know the lists exist and what they structurally contain — we have not counted what's in one.
- **Recall of Tier A is unmeasured.** A creator's guide may hold 20 places while their feed covers 200, or it may be nearly complete. This decides whether Tier A is a foundation or a bonus.

The first two resolve during Phase 0 for free. The third resolves in about ten minutes with a browser.

### Metrics to hold this to

| Metric | Why it matters | Target |
|---|---|---|
| Wrong-venue rate | The trust failure. The only metric that can kill the product. | < 1% |
| Venues per creator crawled | Whether a creator is worth keeping in the set | ≥ 10 |
| Tier A/B share of resolved venues | How much of Tier C you can avoid building | measure first |
| Human minutes per published venue | Whether the pipeline actually beats hand-seeding | < 2 min |

That last one is the honest test of the whole project. SPEC §8 hand-seeding is the incumbent, and a good one — it produces the labelled data, it forces a human to see every venue, and it has no legal exposure. The pipeline has to beat it on cost per *trustworthy* venue, not on raw throughput.

---

## Evidence

Observations from logged-out public profile and link-in-bio pages on 30/08/2026:
[@mingchuun](https://www.instagram.com/mingchuun/) ·
[@tomato_ate_it](https://www.instagram.com/tomato_ate_it/) ·
[linktr.ee/mingchuun](https://linktr.ee/mingchuun) ·
[linktr.ee/tomatoateit](https://linktr.ee/tomatoateit) ·
[@kl.foodie](https://www.instagram.com/kl.foodie/) ·
[@carol.eats](https://www.instagram.com/carol.eats/) ·
[@foodilifecious](https://www.instagram.com/foodilifecious/) ·
[@syengg](https://www.instagram.com/syengg/) ·
[@euniceeunny](https://www.instagram.com/euniceeunny/) ·
[eatdrinkkl.com](https://www.eatdrinkkl.com/)

Creator rankings from [City Kaki](https://www.citykaki.com/malaysias-top-food-influencers/) and [Modash](https://www.modash.io/find-influencers/malaysia/kuala-lumpur/food). Gepuklah background from [SAYS](https://says.com/my/lifestyle/ming-chuns-gepuklah-is-getting-its-first-permanent-restaurant-this-june) and [The Rakyat Post](https://www.therakyatpost.com/news/2026/04/07/supportive-mum-alert-teacher-queues-2-hours-for-sons-ayam-gepuk/).

Follower counts differ between sources and dates; treat as approximate.

Web-published version of this document: https://claude.ai/code/artifact/67cd01d0-979e-44f4-8b6a-7b496b20c362
