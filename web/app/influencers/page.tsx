// Influencers directory (frontend/influencers.html target layout): active
// creators, public read. Reachable while signed out — /influencers is not
// in middleware's GUARDED_PREFIXES.
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { FollowButton } from "@/components/FollowButton";
import { Avatar } from "@/components/Avatar";
import { withAt } from "@/lib/reshape";
import { createClient } from "@/lib/supabase/server";

interface CreatorRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  niche_tags: string[] | null;
  platform_accounts: { handle: string }[] | null;
}

const QUERY_TIMEOUT_MS = 3000;

// A paused/unreachable DB otherwise hangs the server render for the
// platform's default ~10s before anything paints (K2). Race the query
// against a hard timeout and treat a timeout as a fetch error, never as
// "no influencers" (C1/C2).
function withTimeout<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  ms = QUERY_TIMEOUT_MS
): Promise<{ data: T | null; error: { message: string } | null }> {
  const timeout = new Promise<{ data: null; error: { message: string } }>((resolve) =>
    setTimeout(() => resolve({ data: null, error: { message: "timeout" } }), ms)
  );
  return Promise.race([Promise.resolve(query), timeout]);
}

export default async function InfluencersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [creatorsResult, followsResult] = await Promise.all([
    withTimeout<CreatorRow[]>(
      supabase
        .from("creators")
        .select("id, display_name, avatar_url, niche_tags, platform_accounts(handle)")
        .eq("is_active", true)
        .order("display_name", { ascending: true }) as unknown as PromiseLike<{
        data: CreatorRow[] | null;
        error: { message: string } | null;
      }>
    ),
    user
      ? supabase.from("follows").select("creator_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { creator_id: string }[] }),
  ]);

  const { data, error } = creatorsResult;
  const creators = data ?? [];
  const following = new Set((followsResult.data ?? []).map((f) => f.creator_id));

  return (
    <main className="app-column flex flex-1 flex-col gap-4 pb-28 pt-6 text-sheet-on-surface">
      <div>
        <h1 className="font-headline-sheet text-headline-sheet">Curate your following</h1>
        <p className="mt-1 font-body-md text-body-md text-sheet-on-surface-muted">
          Follow local experts to personalize the map.
        </p>
      </div>

      {error ? (
        // C1: a DB failure is not "no influencers" — show a distinct,
        // retryable error state instead of the empty-directory copy.
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
          <h2 className="font-title-md text-title-md text-sheet-on-surface">
            Can&apos;t load influencers right now
          </h2>
          <p className="font-body-md text-sm text-sheet-on-surface-muted">
            Something went wrong on our end. Try again in a moment.
          </p>
          <Link
            href="/influencers"
            className="min-h-11 rounded-lg bg-primary-container px-6 py-3 font-title-md text-title-md text-on-primary shadow-sm active:opacity-90"
          >
            Try again
          </Link>
        </div>
      ) : creators.length === 0 ? (
        // C5: genuine empty state gets a next action, matching /saved.
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
          <h2 className="font-title-md text-title-md text-sheet-on-surface">
            No influencers yet
          </h2>
          <p className="font-body-md text-sm text-sheet-on-surface-muted">
            We&apos;re still onboarding local creators — check back soon.
          </p>
          <Button href="/">Back to map</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-gutter">
          {creators.map((creator) => {
            const handle = withAt(creator.platform_accounts?.[0]?.handle ?? null);
            return (
              // C9: one full-row Link (absolute overlay) instead of two
              // nested Links + a button, so the row is one tap target with
              // the FollowButton as the sole extra stop.
              <Card key={creator.id} className="relative flex items-center gap-4">
                <Link
                  href={`/influencer/${creator.id}`}
                  data-testid="creator-card-link"
                  data-creator-name={creator.display_name}
                  className="absolute inset-0 z-0 rounded-lg"
                  aria-label={creator.display_name}
                />
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-sheet-surface-low">
                  <Avatar src={creator.avatar_url} name={creator.display_name} seed={creator.id} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-title-md text-[16px] text-sheet-on-surface">
                    {creator.display_name}
                  </h3>
                  <p className="truncate text-[13px] text-sheet-on-surface-muted">
                    {handle ?? creator.niche_tags?.join(", ") ?? ""}
                  </p>
                </div>
                <FollowButton
                  creatorId={creator.id}
                  userId={user?.id ?? null}
                  initialFollowing={following.has(creator.id)}
                  loginNext={`/influencer/${creator.id}`}
                  className="relative z-10"
                />
              </Card>
            );
          })}
        </div>
      )}

      <Nav active="influencers" />
    </main>
  );
}
