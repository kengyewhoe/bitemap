-- BiteMap schema, migration 8: grant lockdown (least privilege).
--
-- Supabase's default privileges grant anon/authenticated ALL on every new
-- table (see migration 5's note on place_cards). That default has never been
-- pulled back, so anon/authenticated currently hold insert/update/delete on
-- every table even though RLS denies almost all of it — a defense-in-depth
-- gap, not an active hole, but one bad or missing policy would turn it into
-- one. Revoke the write privileges outright and re-grant only the writes
-- each table's RLS policies (migrations 4 and 7) actually intend. SELECT is
-- left untouched: anon/authenticated reads (via place_cards, nearby_places,
-- creators/platform_accounts/posts) must keep working.

revoke insert, update, delete, truncate, references, trigger on public.users from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.creators from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.platform_accounts from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.places from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.posts from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.user_ratings from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.saved_places from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.follows from anon, authenticated;

-- users: users_update_own policy (migration 4) allows a signed-in user to
-- update their own row; nothing grants insert/delete (rows are created only
-- by the handle_new_user trigger, security definer).
grant update on public.users to authenticated;

-- user_ratings: user_ratings_insert_own policy (migration 4) allows a
-- signed-in user to cast a rating. No update/delete grant — the unique
-- constraint is the vote lock (23505 → 409), matching the "no update/delete
-- policy" note in migration 4.
grant insert on public.user_ratings to authenticated;

-- saved_places / follows: *_insert_own and *_delete_own policies
-- (migration 7) allow a signed-in user to save/unsave and follow/unfollow.
grant insert, delete on public.saved_places to authenticated;
grant insert, delete on public.follows to authenticated;

-- creators, platform_accounts, places, posts: read-only reference data.
-- No write grant for anon or authenticated on any of them.
