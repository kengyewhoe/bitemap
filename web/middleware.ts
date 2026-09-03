import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Per-request CSP nonce, following the official Next.js App Router pattern:
// https://nextjs.org/docs/app/guides/content-security-policy
export async function middleware(request: NextRequest) {
  // Edge runtime (middleware always runs on Edge) has no Node Buffer; use btoa.
  const nonce = btoa(crypto.randomUUID());

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https://*.supabase.co https://api.maptiler.com https://tiles.openfreemap.org",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.maptiler.com https://tiles.openfreemap.org",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  // Set the nonce (and CSP) on the *request* headers so Next can read them
  // via headers() in Server Components and auto-apply the nonce to its own
  // injected scripts. request.headers is a mutable Headers instance, and
  // updateSession() below forwards it into NextResponse.next({ request }),
  // so this propagates downstream.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  // updateSession does the Supabase session refresh + guarded-route
  // redirects; preserve all of that and layer the CSP response header on
  // top of whatever it returns (refreshed auth cookies included).
  const response = await updateSession(request);

  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, manifest, sw.js, icons and other public assets
     * - .mjs (the same-origin maplibre-gl worker + its shared chunk under
     *   public/maplibre-gl/): applying the page CSP to the worker script blocks
     *   its sibling import under 'strict-dynamic', so the worker hangs and no
     *   vector tiles ever parse (blank basemap). Serve it uncapped like other
     *   static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs)$).*)",
  ],
};
