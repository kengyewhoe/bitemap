"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./icons";

export type SaveToggleProps = {
  placeId: string;
  signedIn: boolean;
  /** From a separate authenticated saved_places query. */
  initialSaved: boolean;
};

// Bookmark toggle (frontend/place.html's #save button). Signed out -> the
// same /login?next= redirect contract as VotePanel, but carrying
// `intent=save` (persona-findings.md F2) so the tap survives the OAuth
// round trip instead of being silently dropped. Signed in -> insert/
// delete on saved_places, RLS owner-only (saved_places_insert_own /
// saved_places_delete_own).
export function SaveToggle({ placeId, signedIn, initialSaved }: SaveToggleProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards the auto-save-on-return effect below against firing twice (e.g.
  // React strict-mode double-invoke, or a re-render before the param strip
  // commits).
  const ranIntentRef = useRef(false);

  async function save(user: { id: string }) {
    // Flip optimistically so the tap feels instant; roll back on error.
    setSaved(true);
    const { error: insertError } = await createClient()
      .from("saved_places")
      .insert({ user_id: user.id, place_id: placeId });
    if (insertError) {
      setSaved(false);
      setError("Couldn't save — try again");
    }
  }

  // Post-auth intent: signed in, landed back on this place with
  // ?intent=save (set by the redirect below), and not already saved ->
  // perform the save once, then strip the param so a refresh doesn't
  // re-trigger it. Idempotent: skipped when initialSaved is already true.
  // Reads window.location.search directly (app/page.tsx's start() does the
  // same) rather than useSearchParams, so no Suspense boundary is needed.
  useEffect(() => {
    if (!signedIn || ranIntentRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("intent") !== "save") return;
    ranIntentRef.current = true;

    params.delete("intent");
    const stripped = `/place/${placeId}${params.toString() ? `?${params.toString()}` : ""}`;
    router.replace(stripped);

    if (initialSaved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(true);
    setError(null);
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) return;
        return save(user);
      })
      .finally(() => setPending(false));
    // Runs once per mount on the signed-in landing — deps intentionally
    // narrow (placeId/router are stable enough for this one-shot effect;
    // re-running on every render would re-fire the save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  async function toggle() {
    if (pending) return;

    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/place/${placeId}?intent=save`)}`);
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/place/${placeId}?intent=save`)}`);
      setPending(false);
      return;
    }

    if (!saved) {
      await save(user);
      setPending(false);
      return;
    }

    // Flip optimistically so the tap feels instant; roll back on error.
    setSaved(false);
    const { error: deleteError } = await supabase
      .from("saved_places")
      .delete()
      .eq("user_id", user.id)
      .eq("place_id", placeId);
    if (deleteError) {
      setSaved(true);
      setError("Couldn't save — try again");
    }
    setPending(false);
  }

  return (
    <div className="inline-flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved places" : "Save this place"}
        data-testid="save-toggle"
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${
          saved ? "bg-sheet-surface-low text-primary" : "bg-sheet-surface-low text-sheet-on-surface"
        }`}
      >
        <Icon name="bookmark" filled={saved} size={20} />
      </button>
      {error && (
        <p className="font-body-md text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
