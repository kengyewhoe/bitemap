// design.md §2 map tokens: nocturnal background (#0B0B0C / map-background),
// mango/chili/lime pin accents. This module has NO runtime import of
// maplibre-gl — only a type-only import, which TS erases at compile time —
// so it stays safe to import from anywhere (including server code) without
// pulling the ~250kB maplibre-gl bundle in. The actual GL runtime is
// imported exactly once, in components/Map.tsx.
import type { StyleSpecification } from "maplibre-gl";

// Real target: a MapTiler vector style, tinted dark/nocturnal, gated behind
// NEXT_PUBLIC_MAPTILER_KEY (see web/.env.example — provisioned at ship).
// "dataviz-dark" is MapTiler's nocturnal vector style closest to
// map-background; swap the id here if design picks a different MapTiler
// style at ship time.
const MAPTILER_STYLE_ID = "dataviz-light";

// If this style URL/id ever changes, the sw.js tile cache
// ("bitemap-tiles-v1", cache-first on api.maptiler.com) will keep serving
// stale tiles under the old style until it's bumped — flag that to whoever
// owns public/sw.js. We don't own sw.js so we don't bump it here.
export function maptilerStyleUrl(key: string): string {
  return `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${key}`;
}

// Keyless fallback so the map still renders in dev/CI/forks with no
// MapTiler key provisioned: OpenFreeMap's "positron" vector style — a clean
// light basemap, genuinely free, keyless, and (unlike CARTO's
// basemaps.cartocdn.com raster tiles, which now render an "API KEY REQUIRED"
// watermark) has no watermark. MapLibre consumes this style JSON URL directly.
const OPENFREEMAP_LIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// Returns whatever MapLibre's `style` option accepts: a style JSON URL
// string (MapTiler, or the OpenFreeMap keyless fallback).
export function getMapStyle(): string | StyleSpecification {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) return maptilerStyleUrl(key);
  return OPENFREEMAP_LIGHT_STYLE_URL;
}
