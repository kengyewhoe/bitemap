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
const MAPTILER_STYLE_ID = "dataviz-dark";

// If this style URL/id ever changes, the sw.js tile cache
// ("bitemap-tiles-v1", cache-first on api.maptiler.com) will keep serving
// stale tiles under the old style until it's bumped — flag that to whoever
// owns public/sw.js. We don't own sw.js so we don't bump it here.
export function maptilerStyleUrl(key: string): string {
  return `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${key}`;
}

// Keyless fallback so the map still renders in dev/CI/forks with no
// MapTiler key provisioned: a CARTO dark-matter raster basemap (no API key
// required for reasonable use), tinted toward map-background via a
// background layer underneath the raster tiles.
const FALLBACK_RASTER_STYLE: StyleSpecification = {
  version: 8,
  name: "bitemap-fallback-dark",
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    {
      id: "bitemap-background",
      type: "background",
      paint: { "background-color": "#0B0B0C" },
    },
    {
      id: "carto-dark-layer",
      type: "raster",
      source: "carto-dark",
      paint: { "raster-opacity": 0.85 },
    },
  ],
};

// Returns whatever MapLibre's `style` option accepts: a style JSON URL
// string (MapTiler) or an inline StyleSpecification (keyless fallback).
export function getMapStyle(): string | StyleSpecification {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) return maptilerStyleUrl(key);
  return FALLBACK_RASTER_STYLE;
}
