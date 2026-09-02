// Anon Supabase client for public, edge-cached READ route handlers only.
//
// Deliberately NOT @supabase/ssr and NOT cookie-aware: these routes are
// shared across users behind s-maxage caching, so no per-request auth state
// (cookies, JWT, session) may leak in. Anything requiring the caller's
// identity (e.g. my_vote, POST /ratings) belongs in a separate, uncached,
// cookie-aware route — never here.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function anonClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw Object.assign(new Error("Supabase not configured."), {
      status: 500,
      code: "CONFIG_MISSING",
    });
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Shared response helpers ----------------------------------------------------

export const READ_CACHE_CONTROL = "s-maxage=60, stale-while-revalidate=300";

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export const PLACE_NOT_FOUND = errorBody("PLACE_NOT_FOUND", "This place isn't on BiteMap yet.");
