"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/next-param";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
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
    <div className="min-h-full flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-2xl">Sign in to BiteMap</h1>
        <p className="text-on-surface/70 text-sm">
          Google is the only sign-in method.
        </p>
      </div>

      {(error || callbackError) && (
        <p className="text-sm text-red-600" role="alert">
          {error ?? "Something went wrong signing you in. Please try again."}
        </p>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={pending}
        className="rounded-full bg-on-surface px-6 py-3 text-sm font-semibold text-surface disabled:opacity-60"
      >
        {pending ? "Redirecting…" : "Continue with Google"}
      </button>
    </div>
  );
}
