-- BiteMap MVP schema, migration 3 of 4: functions and views.
-- Source: BACKEND_REQUIREMENTS.md §5.2 (trigger), §5.7.1 (rating counts), §5.8 (place_cards).

-- ---------------------------------------------------------------------------
-- handle_new_user — populates public.users on first Google sign-in.
-- SECURITY DEFINER with an empty search_path; owned by the migration role,
-- which owns public.users, so the insert bypasses RLS as intended (there is
-- deliberately no insert policy on public.users for client roles).
-- ---------------------------------------------------------------------------
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

-- Trigger functions are never called directly; keep EXECUTE away from client roles.
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- private.place_rating_counts — SECURITY DEFINER aggregate-only reader.
--
-- place_cards is security_invoker = true, so a direct join to user_ratings
-- would run under user_ratings_select_own and only ever see the caller's own
-- vote. This function returns just the two aggregates — never a row, never a
-- user_id — so Good/Bad counts stay public without widening row-level access
-- to who voted what. It lives in a schema PostgREST does not expose, so it is
-- only reachable from inside the view's own query, never as a direct RPC.
-- ---------------------------------------------------------------------------
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
-- anon/authenticated call it from inside place_cards (which runs as the
-- querying role); service_role needs it to read place_cards from a seed
-- script. EXECUTE on a definer function never widens row access — the body
-- always runs as the owner and returns only the two aggregates.
grant execute on function private.place_rating_counts(text) to anon, authenticated, service_role;

-- Calling a function in the private schema requires USAGE on the schema too.
-- PostgREST only exposes the schemas listed in the API config (public), so
-- this does not make anything in private reachable over the API.
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- place_cards — derived counts at query time, no stored counters.
-- security_invoker = true (Postgres 15+): the view evaluates RLS on places /
-- posts / platform_accounts as the querying role; without it the view would
-- run with its creator's privileges and bypass every policy in migration 4.
-- ---------------------------------------------------------------------------
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
