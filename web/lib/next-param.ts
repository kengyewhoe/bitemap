// The `?next=` redirect-target contract, shared by middleware.ts,
// app/login/page.tsx, and app/auth/callback/route.ts.
//
// `next` is untrusted input (it round-trips through the browser and, for
// OAuth, through Google) so it is only ever honored when it is a same-origin
// RELATIVE path: exactly one leading '/', no second leading '/' (protocol-
// relative, e.g. "//evil.com"), no backslashes (some browsers normalize
// "\evil.com" to "//evil.com"), and no scheme/host smuggled in. Anything
// else falls back to the caller-supplied default so we never redirect a
// user off BiteMap.
export function safeNext(
  next: string | null | undefined,
  fallback = "/"
): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\")) return fallback;

  try {
    // Resolving against a fixed dummy origin is the simplest way to reuse
    // the platform's own URL parser: if the parsed origin drifts from the
    // dummy, `next` smuggled a scheme/host (e.g. "/\t/evil.com" tricks some
    // parsers) and we reject it.
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}
