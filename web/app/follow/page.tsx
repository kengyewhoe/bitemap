// Follow-onboarding step (frontend/follow.html target layout): list
// creators, let the user follow/unfollow, then "Skip"/"Done" → "/". Guarded
// by middleware (signed-in only — it writes to `follows`), so `user` below
// is always present once middleware has run.
import { createClient } from "@/lib/supabase/server";
import { FollowList, type FollowCreator } from "./FollowList";

export default async function FollowPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [creatorsResult, followsResult] = await Promise.all([
    supabase
      .from("creators")
      .select("id, display_name, bio, avatar_url, niche_tags")
      .eq("is_active", true)
      .order("display_name", { ascending: true }),
    user
      ? supabase.from("follows").select("creator_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { creator_id: string }[] }),
  ]);

  const creators: FollowCreator[] = (creatorsResult.data ?? []).map((c) => ({
    id: c.id,
    displayName: c.display_name,
    bio: c.bio,
    avatarUrl: c.avatar_url,
    tags: c.niche_tags ?? [],
  }));

  const initialFollowing = (followsResult.data ?? []).map(
    (f) => f.creator_id
  );

  return (
    <FollowList
      creators={creators}
      initialFollowing={initialFollowing}
      userId={user?.id ?? null}
    />
  );
}
