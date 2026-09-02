// Browser Supabase client — used in Client Components. Session lives in
// `sb-*` cookies (set/read by @supabase/ssr); this app has no browser-storage
// session concept (see frontend/js/session.js, which this replaces for the
// Next app).
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
