// Creator profile (frontend/influencer.html target layout): public read of
// one creator, their renderable posts (link-out cards, Embed pattern), and a
// Follow toggle. Friendly 404 state if the creator doesn't exist or isn't
// active — distinct from a DB fetch failure, which gets a retryable error
// state instead (C1).
import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/Button";
import { FollowButton } from "@/components/FollowButton";
import { Avatar } from "@/components/Avatar";
import { ImgWithFallback } from "@/components/ImgWithFallback";
import { SourceGlyph } from "@/components/Embed";
import { withAt } from "@/lib/reshape";
import { createClient } from "@/lib/supabase/server";

interface CreatorRow {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  niche_tags: string[] | null;
  platform_accounts: { handle: string; platform: string }[] | null;
}

interface PostRow {
  id: string;
  platform: string;
  post_url: string;
  thumbnail_url: string | null;
  media_kind: string;
  posted_at: string;
  places: { id: string; name: string; area: string | null } | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const QUERY_TIMEOUT_MS = 3000;

// A paused/unreachable DB otherwise hangs the server render for the
// platform's default ~10s before anything paints (K2). Race the gating
// query against a hard timeout and treat a timeout as a fetch error, never
// as "creator not found" (C1/C2).
function withTimeout<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  ms = QUERY_TIMEOUT_MS
): Promise<{ data: T | null; error: { message: string } | null }> {
  const timeout = new Promise<{ data: null; error: { message: string } }>((resolve) =>
    setTimeout(() => resolve({ data: null, error: { message: "timeout" } }), ms)
  );
  return Promise.race([Promise.resolve(query), timeout]);
}

type CreatorResult =
  | { status: "ok"; creator: CreatorRow }
  | { status: "not-found" }
  | { status: "error" };

async function getCreator(id: string): Promise<CreatorResult> {
  const supabase = await createClient();
  const { data, error } = await withTimeout<CreatorRow>(
    supabase
      .from("creators")
      .select("id, display_name, bio, avatar_url, niche_tags, platform_accounts(handle, platform)")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle() as unknown as PromiseLike<{
      data: CreatorRow | null;
      error: { message: string } | null;
    }>
  );
  if (error) return { status: "error" };
  if (!data) return { status: "not-found" };
  return { status: "ok", creator: data };
}

async function getPosts(creatorId: string): Promise<PostRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(
      "id, platform, post_url, thumbnail_url, media_kind, posted_at, places(id, name, area)"
    )
    .eq("creator_id", creatorId)
    .eq("is_self_interest", false)
    .in("ingest_status", ["ready", "matched"])
    .order("posted_at", { ascending: false })
    .limit(20);
  return (data as unknown as PostRow[]) ?? [];
}

async function getFollowState(creatorId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, following: false };
  const { data } = await supabase
    .from("follows")
    .select("creator_id")
    .eq("user_id", user.id)
    .eq("creator_id", creatorId)
    .maybeSingle();
  return { userId: user.id, following: Boolean(data) };
}

// L2: "Curated picks" previously listed the same place once per matched
// post (two posts at the same place = two identical rows). Group matched
// posts by place, keeping first-seen order, and count posts per place so
// the row can say "3 posts". Posts with no matched place stay one row each
// — there's nothing to group them by — and link straight out to Instagram.
type PickRow =
  | {
      kind: "place";
      placeId: string;
      name: string;
      area: string | null;
      thumbnailUrl: string | null;
      mediaKind: string;
      count: number;
    }
  | { kind: "post"; post: PostRow };

function groupPicks(posts: PostRow[]): PickRow[] {
  const rows: PickRow[] = [];
  const placeIndex = new Map<string, number>();

  for (const post of posts) {
    if (!post.places) {
      rows.push({ kind: "post", post });
      continue;
    }
    const existingIndex = placeIndex.get(post.places.id);
    if (existingIndex !== undefined) {
      const row = rows[existingIndex];
      if (row.kind === "place") row.count += 1;
      continue;
    }
    placeIndex.set(post.places.id, rows.length);
    rows.push({
      kind: "place",
      placeId: post.places.id,
      name: post.places.name,
      area: post.places.area,
      thumbnailUrl: post.thumbnail_url,
      mediaKind: post.media_kind,
      count: 1,
    });
  }
  return rows;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getCreator(id);
  return {
    title: result.status === "ok" ? `BiteMap — ${result.creator.display_name}` : "BiteMap — Creator",
  };
}

export default async function InfluencerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getCreator(id);

  if (result.status === "error") {
    // C1: a DB failure is not "this creator doesn't exist" — distinct,
    // retryable state (a server component can only retry via reload/Link).
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-sheet-background px-gutter pb-28 text-center text-sheet-on-surface">
        <h1 className="font-headline-sheet text-headline-sheet">Can&apos;t load this right now</h1>
        <p className="font-body-md text-body-md text-sheet-on-surface-muted">
          Something went wrong on our end. Try again in a moment.
        </p>
        <Link
          href={`/influencer/${id}`}
          className="min-h-11 rounded-lg bg-primary-container px-6 py-3.5 font-title-md text-title-md text-on-primary shadow-sm active:opacity-90"
        >
          Try again
        </Link>
        <Nav active="influencers" />
      </main>
    );
  }

  if (result.status === "not-found") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-sheet-background px-gutter pb-28 text-center text-sheet-on-surface">
        <h1 className="font-headline-sheet text-headline-sheet">
          This creator isn&apos;t on BiteMap
        </h1>
        <p className="font-body-md text-body-md text-sheet-on-surface-muted">
          They may have been removed or never existed.
        </p>
        <Button href="/influencers">Back to influencers</Button>
        <Nav active="influencers" />
      </main>
    );
  }

  const { creator } = result;
  const [posts, { userId, following }] = await Promise.all([
    getPosts(id),
    getFollowState(id),
  ]);

  const handle = withAt(creator.platform_accounts?.[0]?.handle ?? null);
  const picks = groupPicks(posts);

  return (
    <main className="flex-1 bg-sheet-background pb-28">
      <div className="app-column">
        {/* C4: sticky back affordance — Nav highlights "Influencers" even
            on this detail page, so this is otherwise the only way back
            short of the browser gesture. */}
        <div className="sticky top-0 z-10 flex items-center bg-sheet-background/95 py-3 backdrop-blur">
          <Link
            href="/influencers"
            className="inline-flex min-h-11 items-center gap-1.5 rounded font-title-md text-sm font-semibold text-sheet-on-surface-muted"
          >
            <span aria-hidden>←</span> Influencers
          </Link>
        </div>

        <div className="mb-4 flex flex-col items-center pt-3 text-center">
          <div className="mb-3 h-24 w-24 overflow-hidden rounded-full border-4 border-sheet-surface bg-sheet-surface-low text-2xl">
            <Avatar src={creator.avatar_url} name={creator.display_name} seed={creator.id} />
          </div>
          <h1 className="font-headline-sheet text-headline-sheet text-sheet-on-surface">
            {creator.display_name}
          </h1>
          {handle && (
            <p className="mt-1 font-body-md text-sm text-sheet-on-surface-muted">{handle}</p>
          )}
          {creator.bio && (
            <p className="mt-2 font-body-md text-body-md text-sheet-on-surface-muted">
              {creator.bio}
            </p>
          )}
          <FollowButton
            creatorId={creator.id}
            userId={userId}
            initialFollowing={following}
            loginNext={`/influencer/${creator.id}`}
            className="mt-4 px-6 py-2.5"
          />
        </div>

        <h2 className="mb-2 font-title-md text-title-md text-sheet-on-surface">
          Curated picks
        </h2>
        {picks.length === 0 ? (
          <p className="font-body-md text-sm text-sheet-on-surface-muted">
            No mapped spots yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {picks.map((pick) => {
              if (pick.kind === "place") {
                return (
                  <Link key={pick.placeId} href={`/place/${pick.placeId}`} data-testid="creator-pick-link">
                    <div className="flex gap-4 rounded-lg border border-sheet-outline bg-sheet-surface p-3">
                      <ImgWithFallback
                        src={pick.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-20 w-20 shrink-0 rounded-lg object-cover"
                        fallback={
                          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-primary-container/10 text-primary">
                            <SourceGlyph className="h-5 w-5" />
                          </div>
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-title-md text-[16px] text-sheet-on-surface">
                          {pick.name}
                        </h3>
                        {/* R5: a long area name used to wrap, stranding the
                            post count alone on its own line — truncate the
                            area and keep the count fixed-width instead. */}
                        <p className="mt-1 flex items-center gap-1 font-label-caps text-[11px] uppercase text-sheet-on-surface-muted">
                          {pick.area && <span className="min-w-0 truncate">{pick.area} ·</span>}
                          <span className="shrink-0">
                            {pick.count > 1 ? `${pick.count} posts` : "1 post"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              }

              const post = pick.post;
              const platformLabel = PLATFORM_LABELS[post.platform] ?? post.platform;
              return (
                <a
                  key={post.id}
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-4 rounded-lg border border-sheet-outline bg-sheet-surface p-3"
                >
                  <ImgWithFallback
                    src={post.thumbnail_url}
                    alt=""
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                    fallback={
                      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-primary-container/10 text-primary">
                        <SourceGlyph className="h-5 w-5" />
                      </div>
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-title-md text-[16px] text-sheet-on-surface">
                      {platformLabel}
                    </h3>
                    {/* C10: no matched place means the tap leaves the app
                        for Instagram — say so instead of a bare label. */}
                    <p className="mt-1 flex items-center gap-1 font-label-caps text-[11px] uppercase text-sheet-on-surface-muted">
                      <SourceGlyph className="h-3 w-3" />
                      Opens {platformLabel}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      <Nav active="influencers" />
    </main>
  );
}
