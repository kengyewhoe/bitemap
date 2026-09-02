"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeGoodPct } from "@/lib/reshape";
import { GoodBad } from "./GoodBad";
import type { RatingType } from "@/lib/types";

export type VotePanelProps = {
  placeId: string;
  signedIn: boolean;
  /** From a separate authenticated user_ratings query — never from the cached place DTO. */
  initialMyVote: RatingType | null;
  initialGoodCount: number;
  initialBadCount: number;
};

// Wraps GoodBad with BiteMap's vote-lock semantics (rate.html, design.md §5):
// signed out -> /login?next=<relative path>; signed in -> insert into
// user_ratings (RLS: one row per (user_id, place_id)); a 23505 unique-violation
// means the vote is already cast elsewhere, so this locks immediately instead
// of surfacing an error. There is no update/delete path — the vote is final.
export function VotePanel({
  placeId,
  signedIn,
  initialMyVote,
  initialGoodCount,
  initialBadCount,
}: VotePanelProps) {
  const router = useRouter();
  const [vote, setVote] = useState<RatingType | null>(initialMyVote);
  const [locked, setLocked] = useState(initialMyVote !== null);
  const [goodCount, setGoodCount] = useState(initialGoodCount);
  const [badCount, setBadCount] = useState(initialBadCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshCounts(supabase: ReturnType<typeof createClient>) {
    // Read live counts straight from place_cards (security_invoker view, no
    // edge cache) rather than the cached GET /api/places/:id response, so the
    // post-vote percent isn't stale behind the route's s-maxage.
    const { data } = await supabase
      .from("place_cards")
      .select("good_count, bad_count")
      .eq("id", placeId)
      .maybeSingle();
    if (data) {
      setGoodCount(data.good_count);
      setBadCount(data.bad_count);
    }
  }

  async function handleVote(value: RatingType) {
    if (locked || pending) return;

    if (!signedIn) {
      // next-param contract: a relative path starting with a single '/'.
      router.push(`/login?next=/place/${placeId}`);
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=/place/${placeId}`);
      setPending(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("user_ratings")
      .insert({ user_id: user.id, place_id: placeId, rating_type: value });

    if (insertError) {
      if (insertError.code === "23505") {
        // Vote already cast (e.g. a race, or a stale my_vote prop) — lock
        // immediately using the caller's own already-persisted vote.
        const { data: existing } = await supabase
          .from("user_ratings")
          .select("rating_type")
          .eq("place_id", placeId)
          .maybeSingle();
        if (existing) setVote(existing.rating_type as RatingType);
        setLocked(true);
        await refreshCounts(supabase);
      } else {
        setError("Something went wrong. Try again.");
      }
      setPending(false);
      return;
    }

    setVote(value);
    setLocked(true);
    await refreshCounts(supabase);
    setPending(false);
  }

  const total = goodCount + badCount;
  const goodPct = computeGoodPct(goodCount, badCount);

  return (
    <div>
      <GoodBad
        value={vote}
        onVote={handleVote}
        disabled={pending}
        locked={locked}
        goodPct={goodPct}
        totalRatings={total}
      />
      {error && (
        <p className="mt-2 font-body-md text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
