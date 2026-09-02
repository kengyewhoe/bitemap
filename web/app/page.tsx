"use client";

// Home map screen (design.md §4): full-bleed nocturnal map, top search +
// filter + recenter, a "Nearby picks" CTA opening a bottom sheet list, and
// a peek card on pin tap. Fetches GET /api/nearby client-side using the
// browser's geolocation, falling back to KL center / "Browse KL".
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Nav } from "@/components/Nav";
import { BottomSheet } from "@/components/BottomSheet";
import { Card } from "@/components/Card";
import { formatKm, goodPctShort, HALAL_FRIENDLY } from "@/lib/format";
import type { NearbyItem } from "@/lib/types";

// maplibre-gl touches `window` at module scope, so Map must never be part
// of the server render — ssr:false is the boundary that makes that safe.
const MapView = dynamic(() => import("@/components/Map").then((m) => m.Map), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-background" />,
});

const KL_CENTER = { lat: 3.139, lng: 101.687 };
const RADIUS_KM = 5;

export default function HomePage() {
  const [center, setCenter] = useState(KL_CENTER);
  const [recenterNonce, setRecenterNonce] = useState(0);
  const [usingFallback, setUsingFallback] = useState(false);
  const [items, setItems] = useState<NearbyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [halalOnly, setHalalOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<NearbyItem[] | null>(null);
  const [searching, setSearching] = useState(false);

  const loadNearby = useCallback((lat: number, lng: number) => {
    setLoading(true);
    fetch(`/api/nearby?lat=${lat}&lng=${lng}&radius_km=${RADIUS_KM}`)
      .then((res) => res.json())
      .then((data: { items?: NearbyItem[] }) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // Debounced KL-wide search: when `query` is non-empty, hit /api/search
  // instead of just filtering the ~11 already-loaded nearby items. An
  // incrementing request id guards against an older, slower response
  // clobbering a newer one.
  const searchRequestId = useRef(0);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery) {
      searchRequestId.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults(null);
      setSearching(false);
      return;
    }

    const id = ++searchRequestId.current;
    setSearching(true);
    setSheetOpen(true);

    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: trimmedQuery });
      params.set("lat", String(center.lat));
      params.set("lng", String(center.lng));
      fetch(`/api/search?${params.toString()}`)
        .then((res) => res.json())
        .then((data: { items?: NearbyItem[] }) => {
          if (searchRequestId.current !== id) return; // stale response
          setSearchResults(data.items ?? []);
        })
        .catch(() => {
          if (searchRequestId.current !== id) return;
          setSearchResults([]);
        })
        .finally(() => {
          if (searchRequestId.current === id) setSearching(false);
        });
    }, 250);

    return () => clearTimeout(timer);
    // center is intentionally omitted: re-centering shouldn't re-fire an
    // in-flight search, only the debounce/query should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery]);

  const isSearchActive = trimmedQuery.length > 0;

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUsingFallback(true);
      setCenter(KL_CENTER);
      setRecenterNonce((n) => n + 1);
      loadNearby(KL_CENTER.lat, KL_CENTER.lng);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUsingFallback(false);
        setCenter(next);
        setRecenterNonce((n) => n + 1);
        loadNearby(next.lat, next.lng);
      },
      () => {
        setUsingFallback(true);
        setCenter(KL_CENTER);
        setRecenterNonce((n) => n + 1);
        loadNearby(KL_CENTER.lat, KL_CENTER.lng);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }, [loadNearby]);

  const start = useCallback(() => {
    // Coords from /location ("Use my location") win, so arriving with
    // ?lat=&lng= doesn't re-prompt geolocation; otherwise ask on mount.
    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (params.has("lat") && params.has("lng") && Number.isFinite(lat) && Number.isFinite(lng)) {
      setUsingFallback(false);
      setCenter({ lat, lng });
      setRecenterNonce((n) => n + 1);
      loadNearby(lat, lng);
    } else {
      requestLocation();
    }
  }, [loadNearby, requestLocation]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start();
  }, [start]);

  // The halal filter always applies on top of whichever set is active
  // (nearby by default, KL-wide search results while a query is typed).
  // Name/area matching itself is no longer done client-side — /api/search
  // does that across all of KL, not just the ~11 nearby cards.
  const filteredItems = useMemo(() => {
    const baseItems = isSearchActive ? searchResults ?? [] : items;
    if (!halalOnly) return baseItems;
    return baseItems.filter((p) => HALAL_FRIENDLY.has(p.halal_status));
  }, [isSearchActive, searchResults, items, halalOnly]);

  // Derived, not stored: if a selection filters out of view (search/diet
  // filter change), it simply stops resolving to an item here — no effect
  // needed to "clear" it.
  const selectedItem = filteredItems.find((p) => p.id === selectedId) ?? null;

  return (
    <main className="relative flex-1 overflow-hidden bg-map-background">
      <div className="absolute inset-0">
        <MapView
          items={filteredItems}
          center={center}
          recenterNonce={recenterNonce}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
        />
      </div>

      {/* Top bar: search + filter + recenter FAB */}
      <div className="absolute inset-x-0 top-0 z-40 flex items-center gap-2 p-gutter">
        <div className="flex min-w-0 flex-1 items-center rounded-full border border-map-outline bg-map-surface/90 py-1.5 pl-3 pr-1.5 backdrop-blur-md">
          <Icon name="search" size={20} className="flex-shrink-0 text-map-on-surface" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Kuala Lumpur…"
            className="mx-2 min-w-0 flex-1 border-none bg-transparent font-body-md text-body-md text-map-on-surface placeholder:text-sheet-on-surface-muted focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            onClick={() => setHalalOnly((v) => !v)}
            aria-pressed={halalOnly}
            title="Halal-friendly only"
            className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-map-on-surface"
          >
            <Icon name="tune" size={20} filled={halalOnly} />
            {halalOnly && (
              <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary-container" />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={requestLocation}
          title="Recenter"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-map-outline bg-map-surface text-map-on-surface"
        >
          <Icon name="my-location" size={20} />
        </button>
      </div>

      {usingFallback && (
        <div className="absolute left-4 top-16 z-30 rounded-full bg-map-surface/90 px-3 py-1 font-label-caps text-label-caps uppercase text-map-on-surface">
          Browse KL
        </div>
      )}

      {/* Peek card: shown on pin tap while the sheet is closed. */}
      {selectedItem && !sheetOpen && (
        <Link
          href={`/place/${selectedItem.id}`}
          className="absolute inset-x-4 bottom-[104px] z-30 block"
        >
          <Card className="shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <div className="mb-1 flex items-start justify-between gap-2">
              <h3 className="truncate font-headline-sheet text-title-md text-tertiary-dark">
                {selectedItem.name}
              </h3>
              <span className="flex-shrink-0 text-xs font-semibold text-secondary">
                {goodPctShort(selectedItem.good_pct)}
              </span>
            </div>
            <p className="text-[13px] text-sheet-on-surface-muted">
              {[selectedItem.area, formatKm(selectedItem.distance_km)].filter(Boolean).join(" · ")}
            </p>
          </Card>
        </Link>
      )}

      {/* Nearby picks CTA */}
      {!sheetOpen && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="absolute inset-x-4 bottom-24 z-30 flex items-center justify-between rounded-lg bg-primary-container px-5 py-3.5 font-title-md text-title-md text-on-primary-container shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          <span>{isSearchActive ? "Results" : "Nearby picks"}</span>
          <span className="text-sm font-semibold">
            {loading || searching ? "…" : `${filteredItems.length}${isSearchActive ? "" : " nearby"}`}
          </span>
        </button>
      )}

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={isSearchActive ? "Results" : "Nearby picks"}
      >
        <p className="mb-3 -mt-1 font-body-md text-sm text-sheet-on-surface-muted">
          {isSearchActive ? `Results for '${trimmedQuery}'` : `Recent mentions · within ${RADIUS_KM} km`}
        </p>
        {(loading || searching) && <p className="py-8 text-center text-sheet-on-surface-muted">Loading…</p>}
        {!loading && !searching && filteredItems.length === 0 && (
          <div className="rounded-lg border border-sheet-outline bg-sheet-surface-low p-5 text-center">
            <p className="font-title-md text-title-md text-tertiary-dark">
              {isSearchActive ? `No places match '${trimmedQuery}'` : "No places nearby"}
            </p>
            <p className="mt-1 text-sm text-sheet-on-surface-muted">
              {isSearchActive ? "Try a different search term." : "Try clearing search or filters."}
            </p>
          </div>
        )}
        <div className="space-y-2 pb-4">
          {filteredItems.map((item) => (
            <Link
              key={item.id}
              href={`/place/${item.id}`}
              className={`-mx-2 flex gap-4 rounded-lg p-2 ${
                item.id === selectedId ? "bg-sheet-surface-low" : "hover:bg-sheet-surface-low"
              }`}
              onClick={() => setSelectedId(item.id)}
            >
              {item.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail_url}
                  alt=""
                  className="h-16 w-16 flex-shrink-0 rounded-lg border border-sheet-outline object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-sheet-outline bg-sheet-surface-low">
                  <Icon name="restaurant" size={22} className="text-sheet-on-surface-muted" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate font-title-md text-title-md text-tertiary-dark">{item.name}</h3>
                </div>
                <p className="mt-1 text-sm text-sheet-on-surface-muted">
                  {[item.area, formatKm(item.distance_km), goodPctShort(item.good_pct)].filter(Boolean).join(" · ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </BottomSheet>

      <Nav active="map" />
    </main>
  );
}
