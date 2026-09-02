// OAuth return leg: Supabase redirects here with a `code` query param after
// Google auth. Exchanging it for a session sets the `sb-*` cookies via
// lib/supabase/server.ts's cookie adapter, then we send the user on to
// onboarding (/location).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/next-param";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // safeNext rejects anything that isn't a same-origin relative path (see
  // lib/next-param.ts) before it's ever concatenated onto `origin` below.
  const next = safeNext(searchParams.get("next"), "/location");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=auth_callback_failed`
  );
}
