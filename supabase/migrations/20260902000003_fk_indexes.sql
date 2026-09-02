-- BiteMap schema: add missing indexes for foreign-key columns flagged by
-- the Supabase performance advisor (unindexed foreign keys). The composite
-- primary keys on saved_places(user_id, place_id) and follows(user_id,
-- creator_id) already cover user_id lookups; these cover the reverse FK
-- direction (place_id, creator_id).

create index if not exists idx_follows_creator_id on public.follows (creator_id);
create index if not exists idx_saved_places_place_id on public.saved_places (place_id);
