import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/Button";
import { VotePanel } from "@/components/VotePanel";
import { SaveToggle } from "@/components/SaveToggle";
import { Embed } from "@/components/Embed";
import { ImgWithFallback } from "@/components/ImgWithFallback";
import { anonClient } from "@/app/api/_supabase";
import { detailDto, withAt, type PlaceCardRow } from "@/lib/reshape";
import { halalBadge, priceBandLabel, goodPctLabel } from "@/lib/format";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Post, PlaceDetail, RatingType } from "@/lib/types";

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

const QUERY_TIMEOUT_MS = 3000;

// A paused/unreachable DB otherwise hangs the server render for the
// platform's default ~10s before anything paints (K2). Race the gating
// query against a hard timeout and treat a timeout as a fetch error, never
// as "place not found" (C1/C2).
function withTimeout<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  ms = QUERY_TIMEOUT_MS
): Promise<{ data: T | null; error: { message: string } | null }> {
  const timeout = new Promise<{ data: null; error: { message: string } }>((resolve) =>
    setTimeout(() => resolve({ data: null, error: { message: "timeout" } }), ms)
  );
  return Promise.race([Promise.resolve(query), timeout]);
}

type PlaceResult =
  | { status: "ok"; place: PlaceDetail }
  | { status: "not-found" }
  | { status: "error" };

async function getPlace(id: string): Promise<PlaceResult> {
  const supabase = anonClient();
  const { data, error } = await withTimeout<PlaceCardRow>(
    supabase.from("place_cards").select(CARD_COLS).eq("id", id).maybeSingle() as unknown as PromiseLike<{
      data: PlaceCardRow | null;
      error: { message: string } | null;
    }>
  );
  if (error) return { status: "error" };
  if (!data) return { status: "not-found" };
  return { status: "ok", place: detailDto(data) };
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
  const result = await getPlace(id);
  return {
    title: result.status === "ok" ? `BiteMap — ${result.place.name}` : "BiteMap — Place",
  };
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getPlace(id);

  if (result.status === "error") {
    // C1: a DB failure is not "this place isn't on BiteMap" — distinct,
    // retryable state (a server component can only retry via reload/Link).
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-sheet-background px-gutter pb-28 text-center text-sheet-on-surface">
        <h1 className="font-headline-sheet text-headline-sheet">Can&apos;t load this right now</h1>
        <p className="font-body-md text-body-md text-sheet-on-surface-muted">
          Something went wrong on our end. Try again in a moment.
        </p>
        <Link
          href={`/place/${id}`}
          className="min-h-11 rounded-lg bg-primary-container px-6 py-3.5 font-title-md text-title-md text-on-primary shadow-sm active:opacity-90"
        >
          Try again
        </Link>
        <Nav active="map" />
      </main>
    );
  }

  if (result.status === "not-found") {
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

  const { place } = result;
  const [posts, { signedIn, myVote, saved }] = await Promise.all([
    getPosts(id),
    getMyVote(id),
  ]);

  const badge = halalBadge(place.halal_status);
  // C3: price already gets its own badge below — don't print it twice.
  const chips = [place.category, place.area].filter((v): v is string => Boolean(v));

  return (
    <main className="flex-1 bg-sheet-background pb-28">
      <div className="app-column">
        {/* C4: sticky back affordance — Nav highlights "Map" even on this
            detail page, so this is otherwise the only way back short of
            the browser gesture. */}
        <div className="sticky top-0 z-10 flex items-center bg-sheet-background/95 py-3 backdrop-blur">
          <Link
            href="/"
            data-testid="place-back-link"
            className="inline-flex min-h-11 items-center gap-1.5 rounded font-title-md text-sm font-semibold text-sheet-on-surface-muted"
          >
            <span aria-hidden>←</span> Map
          </Link>
        </div>

        <div className="mb-3 flex items-start justify-between gap-2 pt-3">
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

        {/* R1: no photo_url means no hero block at all — a placeholder
            panel here made an otherwise-full page look empty. A photo
            that fails to load (onError) collapses the same way, since
            there's nothing else to show in its place. */}
        {place.photo_url && (
          <div className="mb-4">
            <ImgWithFallback
              src={place.photo_url}
              alt={place.name}
              loading="lazy"
              className="h-36 w-full rounded-lg object-cover"
              fallback={null}
            />
            {place.photo_credit && (
              <p className="mt-1 font-label-caps text-[10px] text-sheet-on-surface-muted">
                {place.photo_credit}
              </p>
            )}
          </div>
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

        {/* R3: an info card with no value ("Not available yet") just made
            the page look unfinished — hide a card whose value is missing,
            and skip the grid entirely rather than leave one lone card. */}
        {(place.hours_note || place.address || place.area) && (
          <div className="mb-5 grid grid-cols-2 gap-2">
            {place.hours_note && (
              <div className="rounded-lg border border-sheet-outline bg-sheet-surface p-3">
                <div className="mb-1 font-title-md text-sm text-sheet-on-surface">Hours</div>
                <div className="font-body-md text-xs text-sheet-on-surface-muted">
                  {place.hours_note}
                </div>
              </div>
            )}
            {(place.address || place.area) && (
              <div className="rounded-lg border border-sheet-outline bg-sheet-surface p-3">
                <div className="mb-1 font-title-md text-sm text-sheet-on-surface">Address</div>
                <div className="font-body-md text-xs text-sheet-on-surface-muted">
                  {place.address || place.area}
                </div>
              </div>
            )}
          </div>
        )}

        <a
          href={directionsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="directions-link"
          className="mb-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-6 py-3.5 font-title-md text-title-md text-on-primary-container shadow-sm active:opacity-90"
        >
          Directions
        </a>

        <h2 className="mb-2 font-title-md text-title-md text-sheet-on-surface">As seen on</h2>
        {posts.length === 0 ? (
          // C12: don't dead-end the page here — point back to the map.
          <div className="mb-4">
            <p className="font-body-md text-sm text-sheet-on-surface-muted">No mentions yet.</p>
            <Link href="/" className="font-body-md text-sm font-semibold text-primary underline">
              See what creators are posting nearby
            </Link>
          </div>
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
