"use client";

// CRITICAL: maplibre-gl is imported ONLY in this file. This component must
// only ever be loaded via `next/dynamic(() => import("./Map"), { ssr: false
// })` from page.tsx — never imported directly (which would drag maplibre-gl
// into the server bundle / SSR pass and break it, since maplibre-gl touches
// `window` at module scope).
import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Map as MapLibreMap, Marker, AttributionControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapStyle } from "@/lib/mapStyle";
import { Pin } from "./Pin";
import type { NearbyItem } from "@/lib/types";

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

function MarkerContent({ item, selected }: { item: NearbyItem; selected: boolean }) {
  // design.md §2: lime (map-lime) = open-now/live — a subtle pulse ring,
  // not a heavy badge. Mango selected glow / chili heat come from Pin.
  const live = item.heat === "low";
  return (
    <div className="relative flex flex-col items-center">
      {live && (
        <span
          aria-hidden
          className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 animate-ping rounded-full bg-map-lime/50"
        />
      )}
      <Pin heat={item.heat} selected={selected} label={item.name} />
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

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: getMapStyle(),
      center: [center.lng, center.lat],
      zoom,
      attributionControl: false,
    });
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => {
      readyRef.current = true;
    });
    mapRef.current = map;

    return () => {
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
      const existing = markersRef.current[item.id];
      if (existing) {
        existing.marker.setLngLat([item.lng, item.lat]);
        existing.root.render(<MarkerContent item={item} selected={selected} />);
        continue;
      }

      const el = document.createElement("div");
      el.style.cursor = "pointer";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(item.id);
      });

      const root = createRoot(el);
      root.render(<MarkerContent item={item} selected={selected} />);

      const marker = new Marker({ element: el, anchor: "top" })
        .setLngLat([item.lng, item.lat])
        .addTo(map);

      markersRef.current[item.id] = { marker, root, el };
    }
  }, [items, selectedId, onSelect]);

  return <div ref={containerRef} className={`h-full w-full bg-map-background ${className}`} />;
}

export default Map;
