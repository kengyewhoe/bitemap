"use client";

// CRITICAL: maplibre-gl is imported ONLY in this file. This component must
// only ever be loaded via `next/dynamic(() => import("./Map"), { ssr: false
// })` from page.tsx — never imported directly (which would drag maplibre-gl
// into the server bundle / SSR pass and break it, since maplibre-gl touches
// `window` at module scope).
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Map as MapLibreMap, Marker, AttributionControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapStyle, resolveEffectiveTheme, subscribeToThemeChange } from "@/lib/mapStyle";
import { Pin } from "./Pin";
import type { NearbyItem } from "@/lib/types";

// Point maplibre-gl at a same-origin copy of its worker runtime under
// public/maplibre-gl/ (synced by scripts/sync-maplibre-worker.mjs) instead
// of letting it resolve its own bundled worker URL. Next/Turbopack
// content-hashes maplibre-gl's worker chunk and its "./maplibre-gl-shared.mjs"
// dependency *independently*, so the worker's hard-coded relative import
// no longer matches the shared chunk's actual emitted filename — the
// worker's module graph 404s the instant the browser tries to load it,
// silently forcing all vector-tile parsing onto the main thread. Serving
// both files, unmodified, as plain static assets from the same directory
// keeps that relative import valid (sibling files, no bundler involved).
setWorkerUrl("/maplibre-gl/maplibre-gl-worker.mjs");

// Below this zoom, pin name labels are hidden — at KL-wide zoom levels
// there are too many pins for every label to fit without colliding.
const LABEL_MIN_ZOOM = 13;

export type LatLng = { lat: number; lng: number };

export type MapProps = {
  items: NearbyItem[];
  center: LatLng;
  /** Bump this to force a re-center even if lat/lng didn't change (e.g. tapping recenter twice at the same spot). */
  recenterNonce?: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  zoom?: number;
  className?: string;
};

type MarkerEntry = { marker: Marker; root: Root; el: HTMLDivElement };

function MarkerContent({ item, selected, showLabel }: { item: NearbyItem; selected: boolean; showLabel: boolean }) {
  // design.md §2: mango selected glow / chili heat come from Pin.
  return (
    <div className="relative flex flex-col items-center">
      <Pin heat={item.heat} selected={selected} label={showLabel ? item.name : undefined} />
    </div>
  );
}

export function Map({ items, center, recenterNonce = 0, selectedId, onSelect, zoom = 14, className = "" }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Plain object, not a `Map` instance — the component itself is named
  // `Map`, which would shadow the global `Map` constructor in this module.
  const markersRef = useRef<Record<string, MarkerEntry>>({});
  const readyRef = useRef(false);
  const showLabelsRef = useRef(zoom >= LABEL_MIN_ZOOM);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error">("loading");

  // Re-render markers (for the zoom-gated label) without needing this in
  // the items/selectedId sync effect's own dependency array.
  const rerenderMarkers = useRef<() => void>(() => {});

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialTheme = resolveEffectiveTheme();
    const map = new MapLibreMap({
      container: containerRef.current,
      style: getMapStyle(initialTheme),
      center: [center.lng, center.lat],
      zoom,
      attributionControl: false,
    });
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => {
      readyRef.current = true;
      setMapState("ready");
      // MapLibre can measure a zero-size container if it initializes before
      // layout settles (e.g. inside a full-bleed absolute-inset parent whose
      // size isn't final on first paint), which leaves the map blank until
      // the user interacts. Force a resize once the map has loaded so it
      // always paints tiles immediately.
      map.resize();
    });
    map.on("error", () => {
      setMapState((prev) => (prev === "loading" ? "error" : prev));
    });
    map.on("zoom", () => {
      const nextShowLabels = map.getZoom() >= LABEL_MIN_ZOOM;
      if (nextShowLabels !== showLabelsRef.current) {
        showLabelsRef.current = nextShowLabels;
        rerenderMarkers.current();
      }
    });
    mapRef.current = map;

    // Keep the map filling its container (and re-triggering tile loads) any
    // time the container's own box changes size, independent of window
    // resize events.
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);

    // Basemap follows the effective theme (data-theme, else OS preference)
    // live: re-select the style whenever either input changes. setStyle
    // swaps only the tile/style layers — the Marker DOM overlays below are
    // independent of map style and survive untouched.
    const unsubscribeTheme = subscribeToThemeChange((theme) => {
      mapRef.current?.setStyle(getMapStyle(theme));
    });

    return () => {
      unsubscribeTheme();
      resizeObserver.disconnect();
      Object.values(markersRef.current).forEach(({ marker, root }) => {
        root.unmount();
        marker.remove();
      });
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // Intentionally init-once: center/zoom changes after mount are handled
    // by the recenter effect below, not by re-creating the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter on center/recenterNonce change (skips the very first mount,
  // already handled by map init above).
  const didInitialCenter = useRef(false);
  useEffect(() => {
    if (!didInitialCenter.current) {
      didInitialCenter.current = true;
      return;
    }
    mapRef.current?.easeTo({ center: [center.lng, center.lat], duration: 600 });
  }, [center.lat, center.lng, recenterNonce]);

  // Sync markers with `items` and `selectedId`.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const render = () => {
      const nextIds = new Set(items.map((i) => i.id));

      // Remove stale markers.
      for (const [id, entry] of Object.entries(markersRef.current)) {
        if (!nextIds.has(id)) {
          entry.root.unmount();
          entry.marker.remove();
          delete markersRef.current[id];
        }
      }

      // Add/update markers.
      for (const item of items) {
        const selected = item.id === selectedId;
        const showLabel = showLabelsRef.current;
        const existing = markersRef.current[item.id];
        if (existing) {
          existing.marker.setLngLat([item.lng, item.lat]);
          existing.root.render(<MarkerContent item={item} selected={selected} showLabel={showLabel} />);
          continue;
        }

        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.setAttribute("role", "button");
        el.tabIndex = 0;
        el.setAttribute("aria-label", `${item.name}, ${item.heat} heat`);
        const select = () => onSelect(item.id);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          select();
        });
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            select();
          }
        });

        const root = createRoot(el);
        root.render(<MarkerContent item={item} selected={selected} showLabel={showLabel} />);

        const marker = new Marker({ element: el, anchor: "top" })
          .setLngLat([item.lng, item.lat])
          .addTo(map);

        markersRef.current[item.id] = { marker, root, el };
      }
    };

    rerenderMarkers.current = render;
    render();
  }, [items, selectedId, onSelect]);

  return (
    <div ref={containerRef} className={`relative h-full w-full bg-map-background ${className}`}>
      {mapState !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-map-background">
          {mapState === "loading" ? (
            <p className="animate-pulse font-body-md text-body-md text-map-on-surface/60">Loading map…</p>
          ) : (
            <p className="font-body-md text-body-md text-map-on-surface/60">Couldn&apos;t load the map.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Map;
