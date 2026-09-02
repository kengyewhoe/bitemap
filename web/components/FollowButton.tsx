"use client";

// Follow/unfollow toggle for a single creator — extracted from
// app/follow/FollowList.tsx's per-row toggle so /influencers and
// /influencer/[id] can share it. Writes straight to `follows` (authed,
// owner-only RLS — supabase/migrations/20260902000001_user_state_tables.sql).
// Signed-out tap routes to /login?next=<relative path> (safeNext contract).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type FollowButtonProps = {
  creatorId: string;
  userId: string | null;
  initialFollowing: boolean;
  /** Relative path (single leading slash) to send signed-out taps to. */
  loginNext: string;
  className?: string;
  followingClassName?: string;
  notFollowingClassName?: string;
};

export function FollowButton({
  creatorId,
  userId,
  initialFollowing,
  loginNext,
  className = "",
  followingClassName = "bg-sheet-surface-low text-sheet-on-surface",
  notFollowingClassName = "bg-primary-container text-on-primary",
}: FollowButtonProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;

    if (!userId) {
      router.push(`/login?next=${loginNext}`);
      return;
    }

    setPending(true);
    const supabase = createClient();
    const wasFollowing = following;

    const { error } = wasFollowing
      ? await supabase
          .from("follows")
          .delete()
          .eq("user_id", userId)
          .eq("creator_id", creatorId)
      : await supabase
          .from("follows")
          .insert({ user_id: userId, creator_id: creatorId });

    if (!error) setFollowing(!wasFollowing);
    setPending(false);
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      className={`shrink-0 rounded-xl px-4 py-2 font-label-caps text-label-caps uppercase disabled:opacity-60 ${
        following ? followingClassName : notFollowingClassName
      } ${className}`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
