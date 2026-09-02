-- BiteMap schema, migration 6: nearby_places RPC.
--
-- Plain-SQL haversine distance (no PostGIS, no extensions) over place_cards,
-- nearest-first. security invoker so place_cards' own security_invoker
-- semantics (and the underlying places/posts RLS) still apply to the
-- querying role — this function widens nothing.
create or replace function public.nearby_places(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 5
)
returns table (
  id text,
  name text,
  lat double precision,
  lng double precision,
  area text,
  category text,
  halal_status public.halal_status,
  price_band public.price_band,
  status public.place_status,
  address text,
  name_aliases text[],
  hours_note text,
  provider_place_id text,
  photo_url text,
  photo_credit text,
  mention_count bigint,
  last_mentioned_at timestamptz,
  good_count bigint,
  bad_count bigint,
  heat text,
  latest_mention_handle text,
  latest_mention_quote text,
  distance_km double precision
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    pc.id,
    pc.name,
    pc.lat,
    pc.lng,
    pc.area,
    pc.category,
    pc.halal_status,
    pc.price_band,
    pc.status,
    pc.address,
    pc.name_aliases,
    pc.hours_note,
    pc.provider_place_id,
    pc.photo_url,
    pc.photo_credit,
    pc.mention_count,
    pc.last_mentioned_at,
    pc.good_count,
    pc.bad_count,
    pc.heat,
    pc.latest_mention_handle,
    pc.latest_mention_quote,
    round(
      (
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_lat)) * cos(radians(pc.lat)) * cos(radians(pc.lng) - radians(p_lng))
            + sin(radians(p_lat)) * sin(radians(pc.lat))
          ))
        )
      )::numeric, 1
    )::double precision as distance_km
  from public.place_cards pc
  where pc.lat is not null
    and pc.lng is not null
    and (
      6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(pc.lat)) * cos(radians(pc.lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(pc.lat))
        ))
      )
    ) <= p_radius_km
  order by distance_km asc;
$$;

grant execute on function public.nearby_places(double precision, double precision, double precision) to anon, authenticated;
