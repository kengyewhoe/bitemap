// Server Supabase client — used in Server Components, Route Handlers, and
// Server Actions. Wired to Next's async `cookies()` (Next 15/16). Server
// Components can't write cookies, so `setAll` there is a no-op guarded by
// try/catch; middleware refreshes the session on every request instead.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` was called from a Server Component. This is fine as
            // long as middleware's `updateSession` also runs, refreshing the
            // user's session cookies.
          }
        },
      },
    }
  );
}
