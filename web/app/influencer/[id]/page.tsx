// Creator profile (frontend/influencer.html target layout): public read of
// one creator, their renderable posts (link-out cards, Embed pattern), and a
// Follow toggle. Friendly 404 state if the creator doesn't exist or isn't
// active.
import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/Button";
import { FollowButton } from "@/components/FollowButton";
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

async function getCreator(id: string): Promise<CreatorRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creators")
    .select("id, display_name, bio, avatar_url, niche_tags, platform_accounts(handle, platform)")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  return (data as unknown as CreatorRow) ?? null;
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const creator = await getCreator(id);
  return { title: creator ? `BiteMap — ${creator.display_name}` : "BiteMap — Creator" };
}

export default async function InfluencerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = await getCreator(id);

  if (!creator) {
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

  const [posts, { userId, following }] = await Promise.all([
    getPosts(id),
    getFollowState(id),
  ]);

  const handle = creator.platform_accounts?.[0]?.handle ?? null;

  return (
    <main className="flex-1 bg-sheet-background pb-28">
      <div className="mx-auto max-w-md px-gutter pt-6">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3 h-24 w-24 overflow-hidden rounded-full border-4 border-sheet-surface bg-sheet-surface-low">
            {creator.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={creator.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <h1 className="font-headline-sheet text-headline-sheet text-sheet-on-surface">
            {creator.display_name}
          </h1>
          {handle && (
            <p className="mt-1 font-body-md text-sm text-sheet-on-surface-muted">
              @{handle}
            </p>
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
        {posts.length === 0 ? (
          <p className="font-body-md text-sm text-sheet-on-surface-muted">
            No mapped spots yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {posts.map((post) => {
              const platformLabel = PLATFORM_LABELS[post.platform] ?? post.platform;
              const inner = (
                <div className="flex gap-4 rounded-lg border border-sheet-outline bg-sheet-surface p-3">
                  {post.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.thumbnail_url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-sheet-surface-low text-center font-label-caps text-[10px] text-sheet-on-surface-muted">
                      {post.media_kind === "reel" ? "Reel" : "Post"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-title-md text-[16px] text-sheet-on-surface">
                      {post.places?.name ?? platformLabel}
                    </h3>
                    <p className="mt-1 font-label-caps text-[11px] uppercase text-sheet-on-surface-muted">
                      {platformLabel}
                      {post.places?.area ? ` · ${post.places.area}` : ""}
                    </p>
                  </div>
                </div>
              );
              return post.places ? (
                <Link key={post.id} href={`/place/${post.places.id}`}>
                  {inner}
                </Link>
              ) : (
                <a
                  key={post.id}
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {inner}
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
