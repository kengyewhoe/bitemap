"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./icons";

export type SaveToggleProps = {
  placeId: string;
  signedIn: boolean;
  /** From a separate authenticated saved_places query. */
  initialSaved: boolean;
};

// Bookmark toggle (frontend/place.html's #save button). Signed out -> the
// same /login?next= redirect contract as VotePanel. Signed in -> insert/
// delete on saved_places, RLS owner-only (saved_places_insert_own /
// saved_places_delete_own).
export function SaveToggle({ placeId, signedIn, initialSaved }: SaveToggleProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;

    if (!signedIn) {
      router.push(`/login?next=/place/${placeId}`);
      return;
    }

    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=/place/${placeId}`);
      setPending(false);
      return;
    }

    if (saved) {
      const { error } = await supabase
        .from("saved_places")
        .delete()
        .eq("user_id", user.id)
        .eq("place_id", placeId);
      if (!error) setSaved(false);
    } else {
      const { error } = await supabase
        .from("saved_places")
        .insert({ user_id: user.id, place_id: placeId });
      if (!error) setSaved(true);
    }
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved places" : "Save this place"}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#323232] text-white disabled:opacity-60"
    >
      <Icon name="bookmark" filled={saved} size={20} />
    </button>
  );
}
