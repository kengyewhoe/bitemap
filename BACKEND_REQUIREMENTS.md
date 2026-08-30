# BiteMap — Backend Requirements (MVP)

**Status:** MVP implementation contract — scoped down per the [MVP cut agreed 30/08/2026](SPEC.md#mvp-cut-agreed-30082026)
**Audience:** Backend / API / data
**Product source:** [`SPEC.md`](SPEC.md) §8 "MVP cut (agreed 30/08/2026)" — where this file and that subsection conflict, the subsection wins.
**Frontend mapping:** [`frontend/BACKEND.md`](frontend/BACKEND.md)
**Launch:** Kuala Lumpur metro · mobile web
**Last updated:** 30/08/2026

This file replaces the earlier broad draft (NestJS/Redis/PostGIS, 13 tables, follows/claims/leaderboard) with exactly what the MVP cut ships. The old draft's shape is preserved in git history and is not a design target — nothing below should be read as "temporarily incomplete" version of it. Cut features are listed in §7 (Deferred) with the schema hook that keeps them cheap to re-add, not implemented early.

---

## 1. Purpose

The backend exists to:

1. Authenticate users via Supabase Auth (Google provider) and gate ratings on a signed-in session.
2. Serve **nearby KL places** — one endpoint feeds both the map pins and the list.
3. Serve **place detail** with influencer mentions as official Instagram embeds, tap-to-load.
4. Record **Good / Bad on a place** (honor-system "I went"), one vote per user per place, locked after submit.
5. Expose the current user via `GET /me`.

It does **not**, in MVP:

- Scrape or call any external API at request time (no Google Places lookups, no oEmbed fetch server-side).
- Host or re-encode video. Instagram embeds render client-side from `post_url`.
- Compute a credibility or weighted-rank formula. `mention_count` (distinct non-self-interest creators) stands in for trust everywhere in the UI.
- Run Redis, background jobs, an oEmbed refresh pipeline, PostGIS, or NestJS.
- Expose an ops API or admin UI. All seeding and moderation is manual, via the Supabase table editor, per [`seed/PLAYBOOK.md`](seed/PLAYBOOK.md).

---

## 2. System context

| Layer | Choice | Requirement |
|---|---|---|
| API | Next.js route handlers, deployed on Vercel | Plain JSON REST, no version prefix — paths match `frontend/BACKEND.md` exactly (`/places/nearby`, not `/v1/places/nearby`). HTTPS only. |
| DB | Supabase Postgres | `lat`/`lng` as `double precision` + haversine in SQL. Hundreds of rows at MVP scale — no PostGIS, no geospatial index. |
| Auth | Supabase Auth, Google provider only | FE uses the Supabase JS client directly; no custom `/auth/*` endpoints on this API. Session = Supabase JWT, read server-side via the Supabase SSR helper. |
| Storage | Supabase Storage | Place photos and creator avatars only. Source CDN URLs (Instagram, Google) expire — bytes are always re-hosted here before going live. |
| Maps | Google Maps + Waze deeplinks, client-side only | No Google Places API calls from this backend. `provider_place_id` is filled by hand during seeding when a place is confirmed on Google Maps. |
| Ingest | None automated | Posts and places are entered by hand via the Supabase table editor, per `seed/PLAYBOOK.md`. No LLM calls, no matching job. |
| Media render | Official Instagram embed (oEmbed iframe), tap-to-load | MVP only renders `platform = 'instagram'` posts this way; other platform values may exist in the schema (a creator's TikTok, say) but have no FE render path yet. |

**Clients:** `frontend/` — mock data + `localStorage` today, becomes a real client of this API. `frontend/BACKEND.md` is rewritten (next task) to copy this file's endpoint JSON verbatim.

**Environments:** One Supabase project is sufficient for MVP. No dev/staging/prod split is required by this contract; add one later if the team wants a safety net before prod writes.

---

## 3. Domain rules (binding)

| Topic | Rule |
|---|---|
| Geography | KL bounding box: south `2.90`, north `3.30`, west `101.50`, east `101.90`. Coordinates outside the box are ignored in favour of the KL centroid `(3.1390, 101.6869)`. |
| Nearby radius | Default and only radius for MVP: **5 km**. `radius_km` is accepted as a query param but the FE always sends `5`. |
| Empty map | Fewer than 3 places within the radius → fall back to city-wide "KL trending" (still KL-only, no `[]` as the sole home state). |
| Guest access | Anyone may browse nearby, place detail, and posts. Signing in (Google) is required only to submit a rating. |
| Rating | Good/Bad on a **place**. Unique `(user_id, place_id)`. Locked after submit — a second vote is `409 VOTE_LOCKED`, never an update. |
| Rating meter | `good_pct` is **null** below 5 total ratings on a place ("Baru — not enough ratings yet"); ratings never affect sort order. |
| Trust proxy | `mention_count` = count of distinct creators with a non-self-interest, matched/ready post on the place. Replaces credibility scoring everywhere in MVP UI. |
| Heat | A display-only hint computed per request, never stored: `high` if ≥ 2 non-self-interest posts in the last 14 days, `low` if the newest post is older than 30 days, else `medium`. |
| Video | Never rehost. Store `post_url` + `thumbnail_url` only; render via the official Instagram embed, tap-to-load. |
| Halal | `halal_status` is never inferred from captions or category. Default and common value is `unknown`, shown plainly — not treated as "not halal." |
| Visit proof | Honor system. No verified-visit flag, no copy anywhere implying verification. |
| Localisation | Distances in km, one decimal. Prices in RM via `price_band`. Areas (Bangsar, TTDI, …), not postcodes. |

---

## 4. Actors and authorization

| Role | Who | Can |
|---|---|---|
| `anon` | No session | Read published places, their posts, and creator info surfaced on those posts. |
| `authenticated` | Signed in via Google | All of `anon`, plus submit one rating per place, read their own rating. |

`users.role` (`user` \| `ops`) is carried over from the broader spec for later ops tooling, but **no endpoint in this contract checks it** — there is no ops API in MVP. Content tables (`creators`, `platform_accounts`, `places`, `posts`) are writable only by the `service_role` key (Supabase table editor and any seed script use it), never by `anon` or `authenticated`.

---

## 5. Schema

Load `supabase:supabase-postgres-best-practices` before changing any of this. Decisions made against it, specific to this schema:

- **Primary keys are `text` slugs**, not `bigint identity` or `uuid`, on `creators`, `platform_accounts`, `places`, and `posts`. These four tables are hand-seeded via the Supabase table editor (`seed/PLAYBOOK.md`), and the existing `seed/*.csv` files already use human-readable slugs as `id` (`two-fold-coffee`, `nomnomswithta`, `post-DcgGW1BPP9j`). At hundreds of rows, index locality from a sequential PK doesn't matter; typing a real FK by hand without a lookup step does. `user_ratings` is written by the app at request time, not by hand, so it keeps a `bigint generated always as identity` surrogate key per the standard guidance. `users.id` mirrors `auth.users.id` (a Supabase-generated `uuid`) — not a free choice, Supabase Auth owns that column.
- **Native Postgres `enum` types**, not `text` + `CHECK`, for every fixed-vocabulary column. The deciding factor here is the Supabase Studio table editor: a column typed as an `enum` renders as a dropdown when someone is hand-seeding a row; a `text` + `CHECK` column is a free-text field where the constraint only bites on save. Given seeding is 100% manual, the dropdown is worth the minor friction of `ALTER TYPE ... ADD VALUE` if a vocabulary grows.
- **`timestamptz` everywhere**, no bare `timestamp`.
- **RLS enabled on every table** (§6). No table is force-RLS'd, so the `service_role` key used for seeding and any future server-side job continues to bypass RLS as intended.
- **A `place_cards` view derives counts** (`mention_count`, `good_count`, `bad_count`, `last_mentioned_at`, `heat`) from `posts` and `user_ratings` at query time. Nothing is stored as a denormalized counter — there is no counter-drift class of bug to worry about at this scale. It is declared `security_invoker = true` (§5.8/§6) — a view is meaningless as an RLS boundary without it, since it would otherwise run with its creator's privileges and ignore the policies below entirely.
- **`good_count`/`bad_count` still go through a `SECURITY DEFINER` function** (`private.place_rating_counts`, §5.7.1), not a direct join, precisely *because* the view is `security_invoker = true`: a direct join to `user_ratings` would inherit the `user_ratings_select_own` policy and only ever see the caller's own vote (or nothing, for `anon`). The function returns just the two aggregates — never a row, never `user_id` — so counts stay public without widening row-level access to who voted what.
- **No spatial index.** `distance_km` is computed with haversine over every published place per the constraint in the shared plan ("hundreds of rows"). A full scan of `places` per `/places/nearby` call is the right amount of engineering for that row count — do not add PostGIS or a bounding-box index preemptively.

### 5.1 Enum types

```sql
create type platform_kind as enum ('instagram', 'tiktok', 'youtube', 'other');
create type creator_content_type as enum ('venue_reviewer', 'recipe', 'travel', 'media_brand', 'photographer');
create type halal_status as enum ('jakim_certified', 'muslim_owned', 'pork_free', 'non_halal', 'unknown');
create type price_band as enum ('under_rm10', 'rm10_25', 'rm25_50', 'rm50_plus');
create type photo_source as enum ('influencer_post', 'google_places', 'own', 'licensed');
create type place_status as enum ('draft', 'published', 'hidden');
create type operational_status as enum ('operational', 'closed_temporarily', 'closed_permanently', 'unknown');
create type post_media_kind as enum ('reel', 'post');
create type post_ingest_status as enum ('pending', 'needs_match', 'matched', 'ready', 'failed', 'excluded', 'takedown');
create type rating_type as enum ('good', 'bad');
create type user_role as enum ('user', 'ops');
```

`post_ingest_status` meanings: `pending` (just entered, unreviewed) → `needs_match` (no place match yet) → `matched` (place assigned) → `ready` (matched and reviewed fit to render) → `failed` (could not be resolved) / `excluded` (deliberately out of scope — sponsored, self-interest handled separately, personal, etc.; pair with `excluded_reason`) / `takedown` (was rendering, pulled). `/places/:id/posts` and the `place_cards` view both treat `matched` and `ready` as the renderable/countable set.

### 5.2 `users`

Mirrors `auth.users`; one row per Supabase-authenticated identity.

```sql
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  last_city text not null default 'KL',
  role user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

A trigger populates it on first Google sign-in (there is no `POST /users` endpoint — Supabase Auth owns account creation):

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name, last_city)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'KL'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 5.3 `creators`

```sql
create table public.creators (
  id text primary key,
  display_name text not null,
  bio text,
  avatar_url text,          -- our Supabase Storage copy
  avatar_source_url text,   -- original CDN URL, for provenance only
  avatar_fetched_at timestamptz,
  niche_tags text[],
  content_type creator_content_type,   -- nullable: set by ops at seed time, never inferred
  is_operator boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`is_operator` flags a creator who posts about their own venue (e.g. `@mingchuun` owns Gepuklah) — their posts are marked `is_self_interest` and excluded from `mention_count`, not deleted. `is_active` lets ops hide a creator (account deleted, brand deal fell through) without losing their post history.

### 5.4 `platform_accounts`

```sql
create table public.platform_accounts (
  id text primary key,
  creator_id text not null references public.creators (id) on delete cascade,
  platform platform_kind not null,
  handle text not null,   -- normalized lowercase, '@' stripped
  external_id text,
  follower_count integer,
  profile_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_accounts_platform_handle_key unique (platform, handle)
);

create index platform_accounts_creator_id_idx on public.platform_accounts (creator_id);
```

### 5.5 `places`

```sql
create table public.places (
  id text primary key,
  provider_place_id text,   -- Google Place ID; nullable — hawker stalls Google doesn't list stay null forever
  name text not null,
  name_aliases text[],
  lat double precision,
  lng double precision,
  address text,
  area text,                -- e.g. Bangsar, TTDI, Jalan Alor — a label, not a geo filter
  category text,
  halal_status halal_status not null default 'unknown',
  price_band price_band,    -- nullable, never guessed
  hours_note text,          -- free text, no hours schema
  operational_status operational_status not null default 'operational',
  photo_url text,           -- our Supabase Storage copy
  photo_source photo_source,
  photo_source_url text,    -- original CDN URL, for provenance only
  photo_credit text,
  photo_fetched_at timestamptz,
  photo_visible boolean not null default true,   -- kill switch
  status place_status not null default 'draft',  -- API only ever lists 'published'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint places_published_has_coords check (
    status <> 'published' or (lat is not null and lng is not null)
  ),
  constraint places_lat_range check (lat is null or lat between -90 and 90),
  constraint places_lng_range check (lng is null or lng between -180 and 180)
);

create unique index places_provider_place_id_key on public.places (provider_place_id) where provider_place_id is not null;
create index places_status_published_idx on public.places (status) where status = 'published';
create index places_area_idx on public.places (area);
```

No `good_count`, `bad_count`, `total_mentions`, or `weighted_rank` columns — all four are derived in `place_cards` (§5.7), not stored, so there is nothing to keep in sync.

### 5.6 `posts`

```sql
create table public.posts (
  id text primary key,
  creator_id text not null references public.creators (id),
  platform_account_id text not null references public.platform_accounts (id),
  place_id text references public.places (id),   -- nullable until matched
  platform platform_kind not null,
  post_url text not null,
  thumbnail_url text,
  media_kind post_media_kind not null,   -- 'reel' | 'post'
  content_summary text,
  is_sponsored boolean not null default false,
  is_self_interest boolean not null default false,   -- excluded from mention_count regardless of ingest_status
  posted_at timestamptz not null,
  ingest_status post_ingest_status not null default 'pending',
  excluded_reason text,   -- set when ingest_status = 'excluded'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_post_url_key unique (post_url)
);

create index posts_creator_id_idx on public.posts (creator_id);
create index posts_platform_account_id_idx on public.posts (platform_account_id);
create index posts_place_id_idx on public.posts (place_id);
create index posts_place_renderable_idx on public.posts (place_id, posted_at desc)
  where ingest_status in ('ready', 'matched') and is_self_interest = false;
```

No `oembed_html` / `oembed_fetched_at` — the FE builds the Instagram embed from `post_url` directly, tap-to-load, with no server-side refresh pipeline. No `sentiment_score` — that was LLM-ingest-only and LLM calls are out of MVP; `content_summary` (hand-written or copied from the caption at seed time) stays, it is what §5.9's post DTO renders as the pull-quote.

### 5.7 `user_ratings`

```sql
create table public.user_ratings (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  place_id text not null references public.places (id) on delete cascade,
  post_id text references public.posts (id),   -- reserved, nullable: see §7 Deferred
  rating_type rating_type not null,
  created_at timestamptz not null default now(),
  constraint user_ratings_user_place_key unique (user_id, place_id)
);

create index user_ratings_place_id_idx on public.user_ratings (place_id);
```

No update or delete path — lock semantics mean the unique constraint is the only enforcement needed. A second `INSERT` for the same `(user_id, place_id)` raises Postgres error `23505`, which the route handler maps to `409 VOTE_LOCKED`.

### 5.7.1 `place_rating_counts` (security definer)

`place_cards` (§5.8) is `security_invoker = true`, so its own table reads run as the querying role — which is exactly right for `places` and `posts` (their `anon`/`authenticated` policies already allow the rows the view needs). It is **not** right for `user_ratings`: `user_ratings_select_own` (§6) only lets a user read their own row, by design — the whole point of the policy is that nobody, `anon` or another `authenticated` user, gets row-level access to who-voted-what.

A broader select policy on `user_ratings` isn't a fix, because RLS is row-level, not column-level: any policy wide enough to let the view sum everyone's votes also lets a client `select user_id from user_ratings` directly and see who voted. Good/Bad counts need to be public; the rows behind them must not be. The one construct that gives both is a `SECURITY DEFINER` function that returns only the two aggregates, in a schema Supabase's API layer doesn't expose (so it isn't reachable as a direct RPC call, only from inside the view's own query):

```sql
create schema if not exists private;

create or replace function private.place_rating_counts(p_place_id text)
returns table (good_count bigint, bad_count bigint)
language sql
security definer
set search_path = ''
stable
as $$
  select
    count(*) filter (where rating_type = 'good'),
    count(*) filter (where rating_type = 'bad')
  from public.user_ratings
  where place_id = p_place_id;
$$;

revoke all on function private.place_rating_counts(text) from public;
grant execute on function private.place_rating_counts(text) to anon, authenticated;
```

`anon`/`authenticated` need `EXECUTE` because `place_cards` runs as the querying role and calls this function from inside its own query — a `SECURITY DEFINER` function's body always runs with its owner's privileges regardless of who's allowed to call it, so granting `EXECUTE` here does not reopen row-level access; it only lets the caller ask "how many good/bad on this place," never "whose."

### 5.8 `place_cards` view

```sql
create view public.place_cards
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.lat,
  p.lng,
  p.area,
  p.category,
  p.halal_status,
  p.price_band,
  p.status,
  p.address,
  p.name_aliases,
  p.hours_note,
  p.provider_place_id,
  case when p.photo_visible then p.photo_url end as photo_url,
  case when p.photo_visible then p.photo_credit end as photo_credit,
  coalesce(mentions.mention_count, 0) as mention_count,
  mentions.last_mentioned_at,
  coalesce(ratings.good_count, 0) as good_count,
  coalesce(ratings.bad_count, 0) as bad_count,
  case
    when coalesce(mentions.recent_count_14d, 0) >= 2 then 'high'
    when mentions.last_mentioned_at is null
      or mentions.last_mentioned_at < now() - interval '30 days' then 'low'
    else 'medium'
  end as heat,
  latest.handle as latest_mention_handle,
  latest.quote as latest_mention_quote
from public.places p
left join lateral (
  select
    count(distinct po.creator_id) as mention_count,
    max(po.posted_at) as last_mentioned_at,
    count(*) filter (where po.posted_at >= now() - interval '14 days') as recent_count_14d
  from public.posts po
  where po.place_id = p.id
    and po.is_self_interest = false
    and po.ingest_status in ('ready', 'matched')
) mentions on true
left join lateral private.place_rating_counts(p.id) as ratings (good_count, bad_count) on true
left join lateral (
  select pa.handle, po.content_summary as quote
  from public.posts po
  join public.platform_accounts pa on pa.id = po.platform_account_id
  where po.place_id = p.id
    and po.is_self_interest = false
    and po.ingest_status in ('ready', 'matched')
  order by po.posted_at desc
  limit 1
) latest on true;
```

`good_pct` is **not** in the view — it depends on the ≥5-rating display rule (§8), which the route handler applies after reading `good_count`/`bad_count` so the null-under-5 threshold lives in one place (application code), not duplicated in SQL.

`good_count`/`bad_count` come from `private.place_rating_counts` (§5.7.1), not a direct join to `user_ratings` — see §6 for why the view being `security_invoker = true` makes that necessary rather than optional.

`photo_visible` is enforced **inside the view**, not by any endpoint: `photo_url`/`photo_credit` come back `null` whenever `places.photo_visible = false`. This is the one and only place that gate is applied — no DTO or route handler needs its own check, and none should add one (a second check would be redundant at best, and could silently disagree with the view at worst).

The column is `places.photo_url`; the JSON field is `thumbnail_url` on the nearby/place item DTO (§8.2, §8.3) — the view keeps the column's real name, and the route handler is what renames `photo_url` → `thumbnail_url` when assembling that DTO, to match the FE's existing field name for card thumbnails. `GET /places/:id` (§8.3) additionally echoes the same value back under its own real column name, `photo_url` — that's the identical asset under two field names for two render contexts (list-card thumbnail vs. full-detail hero image), not two different photos; there is only one photo per place in MVP.

---

## 6. Row-level security

Every table has RLS enabled. There are no `FORCE ROW LEVEL SECURITY` statements, so `service_role` (Supabase table editor, any seed script) continues to read and write everything — that is the intended path for all content writes in MVP.

**`place_cards` (§5.8) is declared `security_invoker = true`** (Postgres 15+, which Supabase runs). Without it, a view created by a migration/admin role executes with that role's privileges regardless of who queries it — silently bypassing every RLS policy below and returning draft/hidden places and non-renderable posts to `anon`. `security_invoker = true` makes the view evaluate RLS on `places` and `posts` as the querying role (`anon` or `authenticated`), exactly as if those tables were queried directly — and for those two tables that's sufficient, because `places_select_published` and `posts_select_renderable` below already grant `anon`/`authenticated` exactly the rows the view needs. The endpoint SQL in §8 still filters `where pc.status = 'published'` on top of that — defense in depth, not a substitute for it.

**It is deliberately *not* sufficient for `user_ratings`.** Under `security_invoker = true`, a direct join from the view to `user_ratings` would also run as the querying role — and `user_ratings_select_own` below only lets a user read their *own* row. `anon` would see zero rows and `authenticated` would see only their own vote, so `good_count`/`bad_count` would silently read as 0-or-1 instead of the place's real totals for everyone except (at most) the caller. Widening `user_ratings_select_own` isn't a fix: RLS is row-level, and any policy broad enough to let the view sum every user's vote is also broad enough to let a client `select user_id from user_ratings` and see who voted on what — a real privacy leak, not a hypothetical one. Counts need to be public; the rows behind them must not be. `place_cards` resolves this by calling `private.place_rating_counts` (§5.7.1), a `SECURITY DEFINER` function that returns only the two aggregates and is never granted to `anon`/`authenticated` as a direct table read — it is the one intentional exception to "the view runs as the querying role," scoped as narrowly as the two integers it returns.

```sql
alter table public.users enable row level security;
alter table public.creators enable row level security;
alter table public.platform_accounts enable row level security;
alter table public.places enable row level security;
alter table public.posts enable row level security;
alter table public.user_ratings enable row level security;

-- users: read/update own row only. Insert happens via the handle_new_user trigger (security definer), never via a client role.
create policy users_select_own on public.users
  for select to authenticated
  using ((select auth.uid()) = id);

create policy users_update_own on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- creators: public read of active creators only.
create policy creators_select_active on public.creators
  for select to anon, authenticated
  using (is_active = true);

-- platform_accounts: public read (no PII beyond a public handle).
create policy platform_accounts_select_all on public.platform_accounts
  for select to anon, authenticated
  using (true);

-- places: public read of published places only.
create policy places_select_published on public.places
  for select to anon, authenticated
  using (status = 'published');

-- posts: public read of renderable, non-self-interest posts on a published place.
create policy posts_select_renderable on public.posts
  for select to anon, authenticated
  using (
    ingest_status in ('ready', 'matched')
    and is_self_interest = false
    and exists (
      select 1 from public.places pl
      where pl.id = posts.place_id and pl.status = 'published'
    )
  );

-- user_ratings: a signed-in user can read and insert only their own row. No update/delete policy — lock semantics.
create policy user_ratings_select_own on public.user_ratings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy user_ratings_insert_own on public.user_ratings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
```

`user_ratings_select_own` is not explicitly called for in the plan header but is required for `GET /places/:id/ratings/me` and the `my_vote` field to work under the anon/authenticated key rather than falling back to `service_role` for a per-user read — noted here as the one addition beyond the brief's literal "insert own" line.

`creators`/`platform_accounts`/`places`/`posts` have no insert/update/delete policy for `anon` or `authenticated` — RLS default-denies those, which is exactly "writable only via service role."

---

## 7. Deferred (cut, not deleted)

| Feature | Cut from MVP because | Schema hook that keeps it cheap later |
|---|---|---|
| Follows | Personalization boost, not core loop | Re-add `follows (user_id, creator_id, created_at)`, no columns elsewhere depend on it. |
| Saves (server-side) | FE already has `localStorage`; no server round-trip needed | Re-add `saves (user_id, place_id, list, created_at)` when a synced saves list ships. |
| Claims | Needs a review UI, which is itself out (no ops API) | Re-add `claim_requests` table and `creators.claim_status` / `claimed_by_user_id` columns together. |
| Reports | Needs triage, which is itself out | Re-add `reports (user_id, target_type, target_id, reason, status, created_at)`. |
| Credibility scoring / leaderboard | UI shows `mention_count` instead | Re-add `creators.legit_count` / `hype_count` / `credibility_score` / `seed_credibility` / `use_seed`. `user_ratings.post_id` is already nullable in this schema — the one hook this needs that would otherwise be a migration — so post-level Legit/Hype votes (§9 of `SPEC.md`) slot in without touching existing rows. |
| oEmbed refresh pipeline / background jobs | No Redis, no job runner in MVP | None needed: FE renders the embed from `post_url` directly each time, no cache to refresh. |
| Ops endpoints / admin UI | Seeding via Supabase table editor instead | `places.status`, `posts.ingest_status`, `posts.excluded_reason`, `places.photo_visible` are the gating columns an ops UI would drive — they already exist, so adding the UI later needs no schema change. |
| PostGIS | Hundreds of rows; haversine in SQL is enough | `places.lat`/`lng` as plain doubles generalize to a `geography(Point,4326)` column later (add column, backfill from lat/lng, swap the query) without a breaking migration. |
| Multi-city | KL-only in MVP | `users.last_city` and `places.area` are already free text; a real multi-city launch would add a `city` column and a bounding-box lookup table, not touch these. |

---

## 8. Endpoints

Base path: none (no `/v1` prefix — matches `frontend/BACKEND.md` paths exactly). All responses `application/json`. Auth via the Supabase session (Bearer JWT from the Supabase JS client); there are no custom `/auth/*` routes on this API — Google sign-in is entirely handled by the Supabase client SDK.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/places/nearby` | optional | Map pins + list, one query. |
| GET | `/places/:id` | optional | Place detail. |
| GET | `/places/:id/posts` | optional | Instagram mentions, newest first. |
| POST | `/places/:id/ratings` | required | Submit Good/Bad, locked after first vote. |
| GET | `/places/:id/ratings/me` | required | The caller's own rating on this place, if any. |
| GET | `/me` | required | Current user + role. |

Timestamps in all JSON below are ISO 8601 (`2026-08-26T09:12:00+08:00`); `DD/MM/YYYY` is a **display** rule for the FE (per `SPEC.md`), not the wire format.

### 8.1 Error shape

```json
{ "error": { "code": "VOTE_LOCKED", "message": "You already rated this place." } }
```

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid `lat`/`lng`, invalid `type` body on a rating, etc. |
| 401 | `UNAUTHENTICATED` | No/invalid Supabase session on an auth-required route. |
| 404 | `PLACE_NOT_FOUND` | Unknown `:id`, or the place is `draft`/`hidden`. |
| 404 | `RATING_NOT_FOUND` | `GET /places/:id/ratings/me` when the caller hasn't rated this place. |
| 409 | `VOTE_LOCKED` | Second `POST /places/:id/ratings` for the same `(user, place)`. |

### 8.2 `GET /places/nearby`

**Query:** `lat` (float), `lng` (float), `radius_km` (float, default `5`, FE always sends `5`).

**Logic:**

1. If `(lat, lng)` is outside the KL bounding box, ignore it and use the KL centroid `(3.1390, 101.6869)` instead.
2. Haversine distance against `place_cards` (§5.8), published places only:

   ```sql
   with candidates as (
     select
       pc.*,
       round(
         (6371 * acos(
           cos(radians($1)) * cos(radians(pc.lat)) * cos(radians(pc.lng) - radians($2))
           + sin(radians($1)) * sin(radians(pc.lat))
         ))::numeric, 1
       ) as distance_km
     from public.place_cards pc
     where pc.status = 'published' and pc.lat is not null
   )
   select * from candidates
   where distance_km <= $3
   order by distance_km asc, mention_count desc
   limit 50;
   ```
3. If fewer than 3 rows come back, re-run the same query with a radius large enough to cover the whole KL bounding box (city-wide "trending") and set `fallback: "kl_trending"`. Otherwise `fallback: null`.
4. `good_pct`: null if `good_count + bad_count < 5`, else `round(100 * good_count / (good_count + bad_count))`.
5. `thumbnail_url` in the item DTO below is `place_cards.photo_url` (see §5.8/§6) — already `null` when the place's `photo_visible = false`, no extra check needed here.

**Request:**

```
GET /places/nearby?lat=3.1287&lng=101.6788&radius_km=5
```

**Response `200`:**

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

**Thin-data example** (< 3 places within 5 km, or an out-of-KL query):

```json
{
  "items": [ /* KL-wide, same item shape, ordered distance-from-centroid ASC then mention_count DESC */ ],
  "fallback": "kl_trending"
}
```

### 8.3 `GET /places/:id`

Same item fields as the nearby DTO, plus `address`, `name_aliases`, `hours_note`, `photo_url`, `photo_credit`, `provider_place_id`, `my_vote` (only when authenticated; `null` if the caller hasn't rated). `photo_url` here is the identical `place_cards.photo_url` value already present as this DTO's inherited `thumbnail_url` field — one asset, two field names for two render contexts (card thumbnail vs. hero image) — and it is `null` under the same `photo_visible` gate, not a separate check.

**Directions deeplinks** (built client-side from this response):

- Google Maps, when `provider_place_id` is present: `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>&query_place_id=<provider_place_id>`
- Google Maps, when `provider_place_id` is null: `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`
- Waze (always available given lat/lng): `https://waze.com/ul?ll=<lat>,<lng>&navigate=yes`

**Request:**

```
GET /places/since-then
```

**Response `200`:**

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

`404 PLACE_NOT_FOUND` if `:id` doesn't exist or `status != 'published'`.

### 8.4 `GET /places/:id/posts`

Newest first, no pagination in MVP (launch inventory is ≥1 mapped post per place, not a deep archive). Rows with `ingest_status` outside `('ready','matched')` or `is_self_interest = true` are excluded from the array — the same filter the `place_cards` view uses for `mention_count`, so what renders and what counts always agree.

**Request:**

```
GET /places/gepuklah-by-mingchuun/posts
```

**Response `200`:**

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

Note: `@mingchuun`'s own posts about Gepuklah exist in `posts` (`is_self_interest = true`) but never appear in this array or in `mention_count` — he owns the venue, per `seed/README.md`.

### 8.5 `POST /places/:id/ratings`

**Body:** `{ "type": "good" | "bad" }`

**Logic:** `401` if unauthenticated. `404 PLACE_NOT_FOUND` if the place isn't `published`. Insert into `user_ratings`; a unique-violation on `(user_id, place_id)` is `409 VOTE_LOCKED`. On success, respond with the freshly computed counts.

**Request:**

```
POST /places/since-then/ratings
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{ "type": "good" }
```

**Response `200`:**

```json
{ "good_count": 19, "bad_count": 2, "good_pct": 90, "my_vote": "good" }
```

**Response `409`:**

```json
{ "error": { "code": "VOTE_LOCKED", "message": "You already rated this place." } }
```

### 8.6 `GET /places/:id/ratings/me`

**Response `200`:** `{ "type": "good" }`
**Response `404`:** `{ "error": { "code": "RATING_NOT_FOUND", "message": "You haven't rated this place yet." } }`

### 8.7 `GET /me`

No custom login/logout/refresh routes — those are handled by the Supabase JS client against Supabase Auth directly. This route reads the current Supabase session server-side and returns the matching `public.users` row.

**Response `200`:**

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

`401 UNAUTHENTICATED` if there is no valid Supabase session.

---

## 9. Display rules (for the FE, normative here because they gate what the API returns)

- `good_pct` is `null` when `good_count + bad_count < 5`. FE copy: "Baru — not enough ratings yet." Never show a percentage computed from fewer than 5 ratings.
- Ratings never influence `distance_km ASC, mention_count DESC` ordering, on `/places/nearby` or anywhere else.
- `mention_count` is always returned as the true count; the FE only renders the "N foodies mentioned this" line when it is `> 1` — that's a display choice, not an API-side omission.
- No "verified visit" copy, ever — ratings are honor-system.
- `halal_status: "unknown"` renders plainly (e.g. a neutral "Halal status: not confirmed"), never as "not halal."

---

## 10. Seeding & media

Manual, via the Supabase table editor — see [`seed/PLAYBOOK.md`](seed/PLAYBOOK.md) for the row-by-row process (not yet written; this file documents the contract that playbook seeds into). `seed/*.csv` is the raw hand-curated research record and is never rewritten or deleted in place — new derived artifacts are new files.

- Photo and avatar bytes are downloaded once and uploaded to Supabase Storage; `photo_url`/`avatar_url` point at the Storage copy, `photo_source_url`/`avatar_source_url` keep the original CDN URL for provenance only (those CDN URLs expire and must never be served directly to the FE).
- `photo_visible = false` is the kill switch for a photo that turns out to be wrong or unlicensed, without deleting the row — enforced entirely by `place_cards` (§5.8/§6), which returns `photo_url`/`photo_credit` as `null` whenever it's set. Flip it in the table editor; no endpoint change needed.
- Posts are seeded with `media_kind` set by hand (`reel` vs `post`, visible from the Instagram URL/thumbnail shape) and `ingest_status` moved from `pending` → `matched` → `ready` as each place match is confirmed and reviewed.
- No automated re-fetch of anything — a photo or oEmbed that goes stale is refreshed by re-running the same manual seeding step.

---

## 11. Relationship to other docs

| Doc | Role |
|---|---|
| `SPEC.md` | Product spec + the binding MVP cut (§8) this file implements. |
| `frontend/BACKEND.md` | Screen → route map for the FE; copies this file's endpoint JSON verbatim. |
| `seed/PLAYBOOK.md` | The manual, row-by-row seeding process for the schema in §5 (not yet written). |
| `seed/*.csv` + `seed/fixtures` | Raw hand-curated research record, and local FE dev fixtures respectively — never the source of truth for the live schema. |
| **This file** | Normative backend contract: schema, RLS, endpoints, display rules. |
