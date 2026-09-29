"use client";

// Submit button for the sign-out <form action={signOut}> in page.tsx.
// useFormStatus() needs a client component nested under the <form>, so this
// is split out of the (server) page — it disables itself while the server
// action is in flight so a double tap can't fire two sign-outs.
import { useFormStatus } from "react-dom";

export function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-error-container bg-sheet-surface py-4 font-title-md text-title-md text-error disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
