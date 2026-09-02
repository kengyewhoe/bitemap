// Influencers directory (frontend/influencers.html target layout): active
// creators, public read. Reachable while signed out — /influencers is not
// in middleware's GUARDED_PREFIXES.
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Card } from "@/components/Card";
import { FollowButton } from "@/components/FollowButton";
import { createClient } from "@/lib/supabase/server";

interface CreatorRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  niche_tags: string[] | null;
  platform_accounts: { handle: string }[] | null;
}

export default async function InfluencersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [creatorsResult, followsResult] = await Promise.all([
    supabase
      .from("creators")
      .select("id, display_name, avatar_url, niche_tags, platform_accounts(handle)")
      .eq("is_active", true)
      .order("display_name", { ascending: true }),
    user
      ? supabase.from("follows").select("creator_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { creator_id: string }[] }),
  ]);

  const creators = (creatorsResult.data ?? []) as unknown as CreatorRow[];
  const following = new Set((followsResult.data ?? []).map((f) => f.creator_id));

  return (
    <main className="flex flex-1 flex-col gap-4 bg-sheet-background px-gutter pb-28 pt-6 text-sheet-on-surface">
      <div>
        <h1 className="font-headline-sheet text-headline-sheet">Curate your following</h1>
        <p className="mt-1 font-body-md text-body-md text-sheet-on-surface-muted">
          Follow local experts to personalize the map.
        </p>
      </div>

      {creators.length === 0 ? (
        <p className="font-body-md text-body-md text-sheet-on-surface-muted">
          No influencers yet.
        </p>
      ) : (
        <div className="flex flex-col gap-gutter">
          {creators.map((creator) => {
            const handle = creator.platform_accounts?.[0]?.handle ?? null;
            return (
              <Card key={creator.id} className="flex items-center gap-4">
                <Link href={`/influencer/${creator.id}`} className="shrink-0">
                  <div className="h-14 w-14 overflow-hidden rounded-full bg-sheet-surface-low">
                    {creator.avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={creator.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                </Link>
                <Link href={`/influencer/${creator.id}`} className="min-w-0 flex-1">
                  <h3 className="truncate font-title-md text-[16px] text-sheet-on-surface">
                    {creator.display_name}
                  </h3>
                  <p className="truncate text-[13px] text-sheet-on-surface-muted">
                    {handle ? `@${handle}` : creator.niche_tags?.join(", ") ?? ""}
                  </p>
                </Link>
                <FollowButton
                  creatorId={creator.id}
                  userId={user?.id ?? null}
                  initialFollowing={following.has(creator.id)}
                  loginNext={`/influencer/${creator.id}`}
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
