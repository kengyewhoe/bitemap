import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/Button";
import { VotePanel } from "@/components/VotePanel";
import { SaveToggle } from "@/components/SaveToggle";
import { Embed } from "@/components/Embed";
import { anonClient } from "@/app/api/_supabase";
import { detailDto, type PlaceCardRow } from "@/lib/reshape";
import { halalBadge, priceBandLabel, goodPctLabel } from "@/lib/format";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Post, RatingType } from "@/lib/types";

// Same column set as app/api/places/[id]/route.ts's CARD_COLS. Duplicated
// (not imported) because that file only exports a route handler — this page
// queries place_cards directly rather than round-tripping through its own
// deployment's HTTP layer, per W1-2's "or call the same Supabase queries
// server-side" option.
const CARD_COLS =
  "id, name, lat, lng, area, category, halal_status, price_band, heat, " +
  "good_count, bad_count, mention_count, last_mentioned_at, " +
  "latest_mention_handle, latest_mention_quote, address, name_aliases, " +
  "hours_note, photo_url, photo_credit, provider_place_id";

interface PostRow {
  id: string;
  platform: string;
  post_url: string;
  thumbnail_url: string | null;
  media_kind: string;
  posted_at: string;
  is_sponsored: boolean;
  content_summary: string | null;
  creators: { id: string | null; display_name: string | null; avatar_url: string | null } | null;
  platform_accounts: { handle: string | null } | null;
}

function withAt(handle: string | null | undefined): string | null {
  if (!handle) return handle ?? null;
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function postDto(p: PostRow): Post {
  return {
    id: p.id,
    platform: p.platform,
    post_url: p.post_url,
    thumbnail_url: p.thumbnail_url,
    media_kind: p.media_kind,
    posted_at: p.posted_at,
    is_sponsored: p.is_sponsored,
    content_summary: p.content_summary,
    creator: {
      id: p.creators?.id ?? null,
      handle: withAt(p.platform_accounts?.handle),
      display_name: p.creators?.display_name ?? null,
      avatar_url: p.creators?.avatar_url ?? null,
    },
  };
}

async function getPlace(id: string) {
  const supabase = anonClient();
  const { data } = await supabase
    .from("place_cards")
    .select(CARD_COLS)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return detailDto(data as unknown as PlaceCardRow);
}

async function getPosts(id: string): Promise<Post[]> {
  const supabase = anonClient();
  const { data } = await supabase
    .from("posts")
    .select(
      "id, platform, post_url, thumbnail_url, media_kind, posted_at, is_sponsored, " +
        "content_summary, creators!inner(id, display_name, avatar_url), " +
        "platform_accounts!inner(handle)"
    )
    .eq("place_id", id)
    .eq("is_self_interest", false)
    .in("ingest_status", ["ready", "matched"])
    .order("posted_at", { ascending: false });
  return ((data ?? []) as unknown as PostRow[]).map(postDto);
}

// my_vote (architect risk #4): GET /api/places/:id is edge-cached and shared
// across every caller, so it never carries a per-user vote. This is a
// separate, uncached, cookie-aware query straight against user_ratings,
// scoped by RLS (user_ratings_select_own: auth.uid() = user_id) to the
// signed-in caller's own row for this place.
async function getMyVote(placeId: string): Promise<{
  signedIn: boolean;
  myVote: RatingType | null;
  saved: boolean;
}> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { signedIn: false, myVote: null, saved: false };

  const [{ data: ratingRow }, { data: savedRow }] = await Promise.all([
    supabase
      .from("user_ratings")
      .select("rating_type")
      .eq("user_id", user.id)
      .eq("place_id", placeId)
      .maybeSingle(),
    supabase
      .from("saved_places")
      .select("place_id")
      .eq("user_id", user.id)
      .eq("place_id", placeId)
      .maybeSingle(),
  ]);

  return {
    signedIn: true,
    myVote: (ratingRow?.rating_type as RatingType | undefined) ?? null,
    saved: Boolean(savedRow),
  };
}

function directionsUrl(p: { lat: number; lng: number; provider_place_id: string | null }) {
  return p.provider_place_id
    ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}&query_place_id=${encodeURIComponent(p.provider_place_id)}`
    : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlace(id);
  return { title: place ? `BiteMap — ${place.name}` : "BiteMap — Place" };
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const place = await getPlace(id);

  if (!place) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-sheet-background px-gutter pb-28 text-center text-sheet-on-surface">
        <h1 className="font-headline-sheet text-headline-sheet">
          This place isn&apos;t on BiteMap yet
        </h1>
        <p className="font-body-md text-body-md text-sheet-on-surface-muted">
          Head back to the map to find what&apos;s nearby.
        </p>
        <Button href="/">Back to map</Button>
        <Nav active="map" />
      </main>
    );
  }

  const [posts, { signedIn, myVote, saved }] = await Promise.all([
    getPosts(id),
    getMyVote(id),
  ]);

  const badge = halalBadge(place.halal_status);
  const chips = [place.category, priceBandLabel(place.price_band), place.area].filter(
    (v): v is string => Boolean(v)
  );

  return (
    <main className="flex-1 bg-sheet-background pb-28">
      <div className="mx-auto max-w-md px-gutter pt-6">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h1 className="font-headline-sheet text-headline-sheet text-sheet-on-surface">
              {place.name}
            </h1>
            <p className="mt-1 font-body-md text-sm text-sheet-on-surface-muted">
              {chips.join(" · ")}
            </p>
          </div>
          <SaveToggle placeId={id} signedIn={signedIn} initialSaved={saved} />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <span
            className={`rounded px-2 py-0.5 font-label-caps text-xs font-semibold ${
              badge.tone === "good"
                ? "bg-secondary-container/40 text-secondary"
                : badge.tone === "bad"
                  ? "bg-error-container text-on-error-container"
                  : "bg-sheet-surface-low text-sheet-on-surface-muted"
            }`}
          >
            {badge.label}
          </span>
          {priceBandLabel(place.price_band) && (
            <span className="rounded bg-sheet-surface-low px-2 py-0.5 font-label-caps text-xs font-semibold text-sheet-on-surface-muted">
              {priceBandLabel(place.price_band)}
            </span>
          )}
          <span className="rounded bg-sheet-surface-low px-2 py-0.5 font-label-caps text-xs font-semibold text-sheet-on-surface-muted">
            {goodPctLabel(place.good_pct)}
          </span>
        </div>

        {place.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.photo_url}
            alt=""
            className="mb-1 h-36 w-full rounded-lg object-cover"
          />
        )}
        {place.photo_credit && (
          <p className="mb-3 font-label-caps text-[10px] text-sheet-on-surface-muted">
            {place.photo_credit}
          </p>
        )}

        <div className="mb-5">
          <VotePanel
            placeId={id}
            signedIn={signedIn}
            initialMyVote={myVote}
            initialGoodCount={place.good_count}
            initialBadCount={place.bad_count}
          />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-sheet-outline bg-sheet-surface p-3">
            <div className="mb-1 font-title-md text-sm text-sheet-on-surface">Hours</div>
            <div className="font-body-md text-xs text-sheet-on-surface-muted">
              {place.hours_note || "Not available yet"}
            </div>
          </div>
          <div className="rounded-lg border border-sheet-outline bg-sheet-surface p-3">
            <div className="mb-1 font-title-md text-sm text-sheet-on-surface">Address</div>
            <div className="font-body-md text-xs text-sheet-on-surface-muted">
              {place.address || place.area || "Not available yet"}
            </div>
          </div>
        </div>

        <a
          href={directionsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-6 py-3.5 font-title-md text-title-md text-on-primary-container shadow-sm active:opacity-90"
        >
          Directions
        </a>

        <h2 className="mb-2 font-title-md text-title-md text-sheet-on-surface">As seen on</h2>
        {posts.length === 0 ? (
          <p className="mb-4 font-body-md text-sm text-sheet-on-surface-muted">
            No mentions yet.
          </p>
        ) : (
          <div>
            {posts.map((post) => (
              <Embed key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>

      <Nav active="map" />
    </main>
  );
}
