// OAuth return leg: Supabase redirects here with a `code` query param after
// Google auth. Exchanging it for a session sets the `sb-*` cookies via
// lib/supabase/server.ts's cookie adapter, then we send the user on to
// onboarding (/location).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/location";

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
