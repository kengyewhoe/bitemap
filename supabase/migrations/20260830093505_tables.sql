-- BiteMap MVP schema, migration 2 of 4: tables, constraints, indexes.
-- Source: BACKEND_REQUIREMENTS.md §5.2–§5.7.
-- Text-slug primary keys on the four hand-seeded content tables are a
-- deliberate decision (§5); user_ratings keeps a bigint identity surrogate.

-- ---------------------------------------------------------------------------
-- users — mirrors auth.users; one row per Supabase-authenticated identity.
-- Populated by the handle_new_user trigger (migration 3), never by a client.
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  last_city text not null default 'KL',
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- creators
-- ---------------------------------------------------------------------------
create table public.creators (
  id text primary key,
  display_name text not null,
  bio text,
  avatar_url text,          -- our Supabase Storage copy
  avatar_source_url text,   -- original CDN URL, for provenance only
  avatar_fetched_at timestamptz,
  niche_tags text[],
  maps_list_url text,       -- creator's public Google Maps list — seeding shortcut, not used by the UI
  content_type public.creator_content_type,   -- nullable: set by ops at seed time, never inferred
  is_operator boolean not null default false,
  is_active boolean not null default true,
  notes text,               -- internal seeding/ops notes, never rendered in the app
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- platform_accounts
-- ---------------------------------------------------------------------------
create table public.platform_accounts (
  id text primary key,
  creator_id text not null references public.creators (id) on delete cascade,
  platform public.platform_kind not null,
  handle text not null,   -- normalized lowercase, '@' stripped
  external_id text,
  follower_count integer,
  profile_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_accounts_platform_handle_key unique (platform, handle)
);

create index platform_accounts_creator_id_idx on public.platform_accounts (creator_id);

-- ---------------------------------------------------------------------------
-- places
-- ---------------------------------------------------------------------------
create table public.places (
  id text primary key,
  provider_place_id text,   -- Google Place ID; nullable — unlisted hawker stalls stay null forever
  name text not null,
  name_aliases text[],
  lat double precision,
  lng double precision,
  address text,
  area text,                -- e.g. Bangsar, TTDI, Jalan Alor — a label, not a geo filter
  category text,
  halal_status public.halal_status not null default 'unknown',
  price_band public.price_band,    -- nullable, never guessed
  hours_note text,          -- free text, no hours schema
  operational_status public.operational_status not null default 'operational',
  photo_url text,           -- our Supabase Storage copy
  photo_source public.photo_source,
  photo_source_url text,    -- original CDN URL, for provenance only
  photo_credit text,
  photo_fetched_at timestamptz,
  photo_visible boolean not null default true,   -- kill switch, enforced in place_cards
  status public.place_status not null default 'draft',  -- API only ever lists 'published'
  notes text,               -- internal seeding/ops notes, never rendered in the app
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

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create table public.posts (
  id text primary key,
  creator_id text not null references public.creators (id),
  platform_account_id text not null references public.platform_accounts (id),
  place_id text references public.places (id),   -- nullable until matched
  platform public.platform_kind not null,
  post_url text not null,
  thumbnail_url text,
  media_kind public.post_media_kind not null,   -- 'reel' | 'post'
  content_summary text,
  is_sponsored boolean not null default false,
  is_self_interest boolean not null default false,   -- excluded from mention_count regardless of ingest_status
  posted_at timestamptz not null,
  ingest_status public.post_ingest_status not null default 'pending',
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

-- ---------------------------------------------------------------------------
-- user_ratings — app-written at request time; bigint identity surrogate key.
-- No update/delete path: the unique constraint is the vote lock (23505 → 409).
-- ---------------------------------------------------------------------------
create table public.user_ratings (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  place_id text not null references public.places (id) on delete cascade,
  post_id text references public.posts (id),   -- reserved, nullable: §7 Deferred
  rating_type public.rating_type not null,
  created_at timestamptz not null default now(),
  constraint user_ratings_user_place_key unique (user_id, place_id)
);

-- user_id lookups (including the RLS policies) are covered by the leading
-- column of user_ratings_user_place_key; place_id needs its own index.
create index user_ratings_place_id_idx on public.user_ratings (place_id);
create index user_ratings_post_id_idx on public.user_ratings (post_id);
