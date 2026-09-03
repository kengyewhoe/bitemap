"use client";

// Client half of the follow-onboarding step: renders the creator list and
// handles follow/unfollow taps. Each tap writes straight to `follows`
// (authed, owner-only RLS — see supabase/migrations/20260902000001) rather
// than batching at "Done", so the toggle state can never drift from the DB.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";

export type FollowCreator = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  tags: string[];
};

type FollowListProps = {
  creators: FollowCreator[];
  initialFollowing: string[];
  userId: string | null;
};

export function FollowList({
  creators,
  initialFollowing,
  userId,
}: FollowListProps) {
  const router = useRouter();
  const [following, setFollowing] = useState<Set<string>>(
    () => new Set(initialFollowing)
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function toggle(creatorId: string) {
    if (!userId || pendingId) return;
    setError(null);
    setPendingId(creatorId);
    const supabase = createClient();
    const wasFollowing = following.has(creatorId);

    const { error: mutationError } = wasFollowing
      ? await supabase
          .from("follows")
          .delete()
          .eq("user_id", userId)
          .eq("creator_id", creatorId)
      : await supabase
          .from("follows")
          .insert({ user_id: userId, creator_id: creatorId });

    if (mutationError) {
      setError("Something went wrong. Try again.");
    } else {
      setFollowing((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.delete(creatorId);
        else next.add(creatorId);
        return next;
      });
    }
    setPendingId(null);
  }

  function finish() {
    startTransition(() => {
      router.push("/");
    });
  }

  return (
    <main className="flex min-h-dvh w-full flex-1 flex-col bg-sheet-surface px-margin-mobile pb-32 pt-8">
      <header className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={finish}
          className="font-label-caps text-label-caps uppercase tracking-widest text-sheet-on-surface-muted"
        >
          Skip
        </button>
      </header>

      <h1 className="mb-2 font-headline-sheet text-headline-sheet text-sheet-on-surface">
        Follow the heat
      </h1>
      <p className="mb-8 font-body-md text-body-md text-sheet-on-surface-muted">
        Choose your expert friends to see what&rsquo;s actually legit in KL.
      </p>

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-gutter">
        {creators.map((creator) => {
          const isFollowing = following.has(creator.id);
          const isPending = pendingId === creator.id;
          return (
            <Card
              key={creator.id}
              className="flex items-center gap-4 p-4"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-sheet-surface-low">
                <Avatar src={creator.avatarUrl} name={creator.displayName} seed={creator.id} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-title-md text-[16px] text-sheet-on-surface">
                  {creator.displayName}
                </h3>
                {creator.bio && (
                  <p className="truncate text-[13px] text-sheet-on-surface-muted">
                    {creator.bio}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => toggle(creator.id)}
                className={`shrink-0 rounded-full px-4 py-2 font-label-caps text-label-caps uppercase disabled:opacity-60 ${
                  isFollowing
                    ? "bg-primary-container text-on-primary"
                    : "border border-primary-container text-primary-container"
                }`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            </Card>
          );
        })}

        {creators.length === 0 && (
          <p className="text-sm text-sheet-on-surface-muted">
            No creators to follow yet.
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-sheet-surface via-sheet-surface to-transparent px-margin-mobile pb-8 pt-12">
        <Button type="button" variant="primary" className="w-full" onClick={finish}>
          See the map
        </Button>
      </div>
    </main>
  );
}
