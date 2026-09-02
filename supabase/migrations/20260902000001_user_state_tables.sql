-- BiteMap schema, migration 7: user-state tables (saved places, follows).
--
-- places.id and creators.id are text primary keys (see migration 2); users.id
-- mirrors auth.users as uuid. RLS restricts every operation to the owning
-- user; no update policy on either table — rows are only created/removed.

create table public.saved_places (
  user_id uuid not null references public.users (id) on delete cascade,
  place_id text not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table public.follows (
  user_id uuid not null references public.users (id) on delete cascade,
  creator_id text not null references public.creators (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id)
);

alter table public.saved_places enable row level security;
alter table public.follows enable row level security;

create policy saved_places_select_own on public.saved_places
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy saved_places_insert_own on public.saved_places
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy saved_places_delete_own on public.saved_places
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy follows_select_own on public.follows
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy follows_insert_own on public.follows
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy follows_delete_own on public.follows
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.saved_places to authenticated;
grant select, insert, delete on public.follows to authenticated;
