-- Link scraped posts to existing seeded places by matching the place name or an
-- alias inside the post caption (content_summary). Longest matching term wins.
-- In-DB only (no geocoding / external calls). Idempotent: only touches posts
-- still in needs_match, and setting a place_id + 'matched' surfaces them in the
-- app (place page + creator profile filter on ingest_status in ready/matched).
-- Posts whose venue is not a seeded place stay needs_match (need a new place row
-- with coords — deferred; requires geocoding).
WITH matches AS (
  SELECT p.id AS post_id, pl.id AS place_id,
    row_number() OVER (PARTITION BY p.id ORDER BY length(t.term) DESC) AS rn
  FROM posts p
  JOIN places pl ON true
  JOIN LATERAL (
    SELECT unnest(array[pl.name] || coalesce(pl.name_aliases, '{}')) AS term
  ) t ON p.content_summary ILIKE '%' || t.term || '%'
  WHERE p.ingest_status = 'needs_match'
    AND p.id LIKE 'ig-%'
    AND p.content_summary IS NOT NULL
)
UPDATE posts p
SET place_id = m.place_id, ingest_status = 'matched', updated_at = now()
FROM matches m
WHERE p.id = m.post_id AND m.rn = 1;
