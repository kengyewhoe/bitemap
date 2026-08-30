-- BiteMap MVP schema, migration 1 of 4: enum types.
-- Source: BACKEND_REQUIREMENTS.md §5.1.
-- Native enums (not text + CHECK) are a deliberate decision (§5): the Supabase
-- Studio table editor renders enum columns as dropdowns, which matters because
-- all content seeding is manual.

create type public.platform_kind as enum ('instagram', 'tiktok', 'youtube', 'other');

create type public.creator_content_type as enum ('venue_reviewer', 'recipe', 'travel', 'media_brand', 'photographer');

create type public.halal_status as enum ('jakim_certified', 'muslim_owned', 'pork_free', 'non_halal', 'unknown');

create type public.price_band as enum ('under_rm10', 'rm10_25', 'rm25_50', 'rm50_plus');

create type public.photo_source as enum ('influencer_post', 'google_places', 'own', 'licensed');

create type public.place_status as enum ('draft', 'published', 'hidden');

create type public.operational_status as enum ('operational', 'closed_temporarily', 'closed_permanently', 'unknown');

create type public.post_media_kind as enum ('reel', 'post');

create type public.post_ingest_status as enum ('pending', 'needs_match', 'matched', 'ready', 'failed', 'excluded', 'takedown');

create type public.rating_type as enum ('good', 'bad');

create type public.user_role as enum ('user', 'ops');
