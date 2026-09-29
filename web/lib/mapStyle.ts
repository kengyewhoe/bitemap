// design.md §2 map tokens: nocturnal background (#0B0B0C / map-background),
// mango/chili/lime pin accents. This module has NO runtime import of
// maplibre-gl — only a type-only import, which TS erases at compile time —
// so it stays safe to import from anywhere (including server code) without
// pulling the ~250kB maplibre-gl bundle in. The actual GL runtime is
// imported exactly once, in components/Map.tsx.
import type { StyleSpecification } from "maplibre-gl";

export type MapTheme = "light" | "dark";

// Real target: MapTiler vector styles, one per theme. "dataviz-dark" is
// MapTiler's nocturnal vector style closest to map-background;
// "dataviz-light" its light counterpart — swap the ids here if design picks
// different MapTiler styles at ship time.
const MAPTILER_STYLE_ID: Record<MapTheme, string> = {
  light: "dataviz-light",
  dark: "dataviz-dark",
};

// If this style URL/id ever changes, the sw.js tile cache
// ("bitemap-tiles-v1", cache-first on api.maptiler.com) will keep serving
// stale tiles under the old style until it's bumped — flag that to whoever
// owns public/sw.js. We don't own sw.js so we don't bump it here.
export function maptilerStyleUrl(key: string, theme: MapTheme): string {
  return `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID[theme]}/style.json?key=${key}`;
}

// Keyless fallback so the map still renders in dev/CI/forks with no
// MapTiler key provisioned: OpenFreeMap's "positron"/"dark" vector styles —
// genuinely free, keyless, and (unlike CARTO's basemaps.cartocdn.com raster
// tiles, which now render an "API KEY REQUIRED" watermark) have no
// watermark. MapLibre consumes these style JSON URLs directly.
const OPENFREEMAP_STYLE_URL: Record<MapTheme, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

// Returns whatever MapLibre's `style` option accepts: a style JSON URL
// string (MapTiler, or the OpenFreeMap keyless fallback), picked for the
// given resolved theme so the basemap matches the app's light/dark chrome
// instead of always rendering light.
export function getMapStyle(theme: MapTheme): string | StyleSpecification {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) return maptilerStyleUrl(key, theme);
  return OPENFREEMAP_STYLE_URL[theme];
}

// Resolves the *effective* theme the rest of the app is using right now:
// ThemeToggle's explicit `data-theme` attribute on <html> wins when set,
// otherwise fall back to the OS-level `prefers-color-scheme` — same
// precedence as the CSS cascade in app/globals.css. Client-only; callers
// (components/Map.tsx) must only invoke this after mount.
export function resolveEffectiveTheme(): MapTheme {
  if (typeof document !== "undefined") {
    const explicit = document.documentElement.dataset.theme;
    if (explicit === "light" || explicit === "dark") return explicit;
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

// Notifies `onChange` with the newly-resolved theme whenever either input
// to resolveEffectiveTheme() changes: the OS preference (matchMedia
// "change") or ThemeToggle flipping `data-theme` on <html> (a plain
// attribute set, not a custom event — a MutationObserver is the only way to
// observe it from here). Returns an unsubscribe function.
export function subscribeToThemeChange(onChange: (theme: MapTheme) => void): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const notify = () => onChange(resolveEffectiveTheme());

  mediaQuery.addEventListener("change", notify);
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return () => {
    mediaQuery.removeEventListener("change", notify);
    observer.disconnect();
  };
}
