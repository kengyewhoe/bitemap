// Copies maplibre-gl's worker runtime into public/ so the browser can load
// it as a plain, same-origin static file instead of going through Next's
// bundler asset pipeline.
//
// Why this exists: maplibre-gl ships its worker as two files —
// maplibre-gl-worker.mjs, which does `import ... from "./maplibre-gl-shared.mjs"`
// (a hard-coded *relative* specifier baked into the npm package). When
// Next/Turbopack picks up `new Worker(new URL("./maplibre-gl-worker.mjs", import.meta.url))`
// inside maplibre-gl's main bundle, it treats the worker file as an opaque
// static asset and content-hashes it on its own — but it does the same,
// independently, for maplibre-gl-shared.mjs, giving the two files
// *different* hashes. The worker's relative import still points at the
// literal string "./maplibre-gl-shared.mjs", which no longer matches the
// shared file's actual (hashed) emitted name, so the worker's own module
// graph 404s the moment the browser tries to load it — surfacing as an
// opaque, detail-free `Worker.onerror` (and, depending on how the request
// gets routed, a "non-JavaScript MIME type" console error from Next's HTML
// 404 fallback). That silently forces all vector-tile parsing onto the
// main thread, tanking home-page LCP/TBT.
//
// Fix: copy both files, unmodified, into the same public/ directory so
// their relative import continues to resolve correctly (same origin,
// sibling files, no bundler involved), then point maplibre-gl at the
// worker via `setWorkerUrl()` (components/Map.tsx) instead of letting it
// resolve its own bundled worker URL.
//
// Re-run automatically before every dev/build via the "predev"/"prebuild"
// npm scripts, so this never drifts from the installed maplibre-gl version.
// Output lives under public/maplibre-gl/ and is .gitignore'd.

import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");

const srcDir = join(webRoot, "node_modules", "maplibre-gl", "dist");
const destDir = join(webRoot, "public", "maplibre-gl");

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

for (const file of files) {
  const src = join(srcDir, file);
  const dest = join(destDir, file);
  if (!existsSync(src)) {
    console.error(`[sync-maplibre-worker] missing ${src} — is maplibre-gl installed?`);
    process.exit(1);
  }
  copyFileSync(src, dest);
}

console.log(`[sync-maplibre-worker] synced ${files.join(", ")} -> public/maplibre-gl/`);
