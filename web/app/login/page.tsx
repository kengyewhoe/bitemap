"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/next-param";
import { Icon } from "@/components/icons";

// Brand mark + headline, shared between the Suspense fallback (shown while
// useSearchParams resolves) and the real form below, so the fallback isn't
// a blank flash — it's the same header, just without the route-specific
// reason line (that needs the search params) or the button.
function LoginHeader() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container/15 text-primary-container"
      >
        <Icon name="map" size={28} />
      </div>
      <h1 className="font-headline-sheet text-headline-sheet">
        Sign in to BiteMap
      </h1>
    </div>
  );
}

// Every guarded route lands here with its own `?next=`, so the reason line
// names *why this route* needs sign-in instead of a generic prompt.
function reasonForNext(next: string): string {
  if (next.startsWith("/saved")) return "Sign in to see places you've saved.";
  if (next.startsWith("/follow")) return "Sign in to follow creators.";
  if (next.startsWith("/me")) return "Sign in to see your profile.";
  return "Sign in to start exploring BiteMap.";
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <LoginForm />
    </Suspense>
  );
}

function Fallback() {
  return (
    <main className="min-h-full flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <LoginHeader />
    </main>
  );
}

function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  // Validated again (safeNext) here on the way out, and once more by
  // /auth/callback on the way back in — the value only ever survives the
  // OAuth round-trip as a query string, so both ends must distrust it.
  const next = safeNext(searchParams.get("next"), "/location");

  async function handleGoogleSignIn() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    // signInWithOAuth redirects the browser to Google itself. Do NOT navigate
    // here (location.href / router.push) — a manual nav races the OAuth
    // redirect and can abort it (see HANDOVER-auth-deploy-findings.md, the
    // login.html:38-39 bug this page must not repeat).
    if (error) {
      setError(error.message);
      setPending(false);
    }
  }

  return (
    <main className="min-h-full flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <LoginHeader />
      <p className="max-w-xs text-center text-sm text-on-surface/70">
        {reasonForNext(next)}
      </p>

      {(error || callbackError) && (
        <p className="text-sm text-error" role="alert">
          {error ?? "Something went wrong signing you in. Please try again."}
        </p>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={pending}
        data-testid="google-signin-btn"
        className="inline-flex items-center gap-3 rounded-full bg-on-surface px-6 py-3 text-sm font-semibold text-surface disabled:opacity-60"
      >
        {!pending && (
          // Google's official multicolor "G" mark — brand colors, not theme
          // tokens; Google's guidelines require it rendered full-color in
          // both light and dark UI, so it's exempt from the token rule.
          <svg aria-hidden width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
            />
          </svg>
        )}
        {pending ? "Redirecting…" : "Continue with Google"}
      </button>

      <Link
        href="/"
        className="inline-flex min-h-11 items-center px-2 text-sm text-on-surface/70 underline underline-offset-2"
      >
        Keep browsing the map
      </Link>
    </main>
  );
}
