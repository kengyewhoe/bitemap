// Wire-contract DTO types for BiteMap's API surface (BACKEND_REQUIREMENTS.md §8).
// snake_case field names match the contract and frontend/js/api.js exactly.

export type HalalStatus =
  | "jakim_certified"
  | "muslim_owned"
  | "pork_free"
  | "non_halal"
  | "unknown";

export type PriceBand = "under_rm10" | "rm10_25" | "rm25_50" | "rm50_plus";

export type Heat = "high" | "medium" | "low";

export type RatingType = "good" | "bad";

export interface LatestMention {
  handle: string;
  quote: string | null;
}

// GET /places/nearby item (§8.2) and the shared prefix of GET /places/:id (§8.3).
export interface NearbyItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  area: string | null;
  category: string | null;
  halal_status: HalalStatus;
  price_band: PriceBand | null;
  distance_km: number | null;
  heat: Heat;
  good_count: number;
  bad_count: number;
  good_pct: number | null;
  mention_count: number;
  last_mentioned_at: string | null;
  thumbnail_url: string | null;
  latest_mention: LatestMention | null;
}

// GET /places/:id (§8.3) — nearby fields minus distance_km/last_mentioned_at, plus detail fields.
export interface PlaceDetail {
  id: string;
  name: string;
  lat: number;
  lng: number;
  area: string | null;
  category: string | null;
  halal_status: HalalStatus;
  price_band: PriceBand | null;
  heat: Heat;
  good_count: number;
  bad_count: number;
  good_pct: number | null;
  mention_count: number;
  thumbnail_url: string | null;
  latest_mention: LatestMention | null;
  address: string | null;
  name_aliases: string[] | null;
  hours_note: string | null;
  photo_url: string | null;
  photo_credit: string | null;
  provider_place_id: string | null;
  my_vote: RatingType | null;
}

export interface Creator {
  id: string | null;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

// GET /places/:id/posts item (§8.4).
export interface Post {
  id: string;
  platform: string;
  post_url: string;
  thumbnail_url: string | null;
  media_kind: string;
  posted_at: string;
  is_sponsored: boolean;
  content_summary: string | null;
  creator: Creator;
}

// GET /me (§8.7).
export interface Me {
  id: string;
  email: string | null;
  display_name: string;
  last_city: string;
  role: string;
  created_at: string | null;
}
