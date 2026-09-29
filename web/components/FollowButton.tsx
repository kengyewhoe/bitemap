"use client";

// Follow/unfollow toggle for a single creator — extracted from
// app/follow/FollowList.tsx's per-row toggle so /influencers and
// /influencer/[id] can share it. Writes straight to `follows` (authed,
// owner-only RLS — supabase/migrations/20260902000001_user_state_tables.sql).
// Signed-out tap routes to /login?next=<relative path>&intent=follow
// (safeNext contract; persona-findings.md F2 carries the intent through the
// OAuth round trip the same way SaveToggle does).
import { useEffect, useRef, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  // Guards the auto-follow-on-return effect below against firing twice.
  const ranIntentRef = useRef(false);

  async function follow(uid: string) {
    setFollowing(true);
    const { error: writeError } = await createClient()
      .from("follows")
      .insert({ user_id: uid, creator_id: creatorId });
    if (writeError) {
      setFollowing(false);
      setError("Couldn't update — try again");
    }
  }

  // Post-auth intent: signed in, landed back on THIS creator's own page
  // (the redirect's next target) with ?intent=follow, and not already
  // following -> follow once, then strip the param. Idempotent: skipped
  // when initialFollowing is already true. Reads window.location directly
  // (no useSearchParams) so no Suspense boundary is needed.
  useEffect(() => {
    if (!userId || ranIntentRef.current) return;
    if (window.location.pathname !== `/influencer/${creatorId}`) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("intent") !== "follow") return;
    ranIntentRef.current = true;

    params.delete("intent");
    const stripped = `/influencer/${creatorId}${params.toString() ? `?${params.toString()}` : ""}`;
    router.replace(stripped);

    if (initialFollowing) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(true);
    setError(null);
    follow(userId).finally(() => setPending(false));
    // One-shot on the signed-in landing; see SaveToggle's identical note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function toggle() {
    if (pending) return;

    if (!userId) {
      router.push(`/login?next=${encodeURIComponent(`${loginNext}?intent=follow`)}`);
      return;
    }

    setPending(true);
    setError(null);

    if (!following) {
      await follow(userId);
      setPending(false);
      return;
    }

    // Flip optimistically; roll back below if the write fails.
    setFollowing(false);
    const { error: writeError } = await createClient()
      .from("follows")
      .delete()
      .eq("user_id", userId)
      .eq("creator_id", creatorId);
    if (writeError) {
      setFollowing(true);
      setError("Couldn't update — try again");
    }
    setPending(false);
  }

  return (
    <div className="inline-flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        data-testid="follow-toggle"
        className={`shrink-0 rounded-xl min-h-11 px-5 py-2 font-label-caps text-label-caps uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${
          following ? followingClassName : notFollowingClassName
        } ${className}`}
      >
        {following ? "Following" : "Follow"}
      </button>
      {error && (
        <p className="font-body-md text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
