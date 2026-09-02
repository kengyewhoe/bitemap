// GUARDED ROUTES — update this list as Wave 1/2 screens land.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const GUARDED_PREFIXES = ["/me", "/saved", "/follow"];

function isGuarded(pathname: string): boolean {
  return GUARDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// Refreshes the Supabase auth session on every request (server components
// can't write cookies, so this is where the refreshed `sb-*` cookies get
// persisted) and redirects unauthenticated users away from guarded routes.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run any logic between createServerClient and getUser(). A simple
  // mistake could make it very hard to debug issues with users being
  // randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isGuarded(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // IMPORTANT: return supabaseResponse as-is (or a new response built from
  // its cookies) — copying it or returning a fresh NextResponse.next() here
  // drops the refreshed session cookies and breaks auth.
  return supabaseResponse;
}
