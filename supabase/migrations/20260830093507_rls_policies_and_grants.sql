-- BiteMap MVP schema, migration 4 of 4: RLS + column-level grants.
-- Source: BACKEND_REQUIREMENTS.md §6.
--
-- RLS is enabled on every table. No FORCE ROW LEVEL SECURITY anywhere, so
-- service_role (Supabase table editor, seed scripts) continues to read and
-- write everything — the intended path for all content writes in MVP.
-- creators/platform_accounts/places/posts get no insert/update/delete policy
-- for anon or authenticated: RLS default-denies those writes.

alter table public.users enable row level security;
alter table public.creators enable row level security;
alter table public.platform_accounts enable row level security;
alter table public.places enable row level security;
alter table public.posts enable row level security;
alter table public.user_ratings enable row level security;

-- users: read/update own row only. Insert happens via the handle_new_user
-- trigger (security definer), never via a client role.
create policy users_select_own on public.users
  for select to authenticated
  using ((select auth.uid()) = id);

create policy users_update_own on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- creators: public read of all creators. is_active is an ops/seeding flag, not
-- a visibility gate (§5.3) — a deactivated creator's identity fields stay
-- visible because their posts keep rendering. The internal notes column is
-- kept out of reach by the column-level grants below, not by this policy.
create policy creators_select_all on public.creators
  for select to anon, authenticated
  using (true);

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

-- user_ratings: a signed-in user can read and insert only their own row.
-- No update/delete policy — lock semantics (23505 on the unique key → 409).
create policy user_ratings_select_own on public.user_ratings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy user_ratings_insert_own on public.user_ratings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Column-level privileges on creators and places (§6).
-- RLS is row-level only: the select policies above decide which rows are
-- visible, but every column on an allowed row would be readable. Both tables
-- carry an internal `notes` column that must never reach a client, so the
-- blanket SELECT is revoked and re-granted on every column except `notes`.
-- ---------------------------------------------------------------------------
revoke select on public.creators from anon, authenticated;
grant select (
  id, display_name, bio, avatar_url, avatar_source_url, avatar_fetched_at,
  niche_tags, maps_list_url, content_type, is_operator, is_active,
  created_at, updated_at
) on public.creators to anon, authenticated;

revoke select on public.places from anon, authenticated;
grant select (
  id, provider_place_id, name, name_aliases, lat, lng, address, area,
  category, halal_status, price_band, hours_note, operational_status,
  photo_url, photo_source, photo_source_url, photo_credit, photo_fetched_at,
  photo_visible, status, created_at, updated_at
) on public.places to anon, authenticated;
