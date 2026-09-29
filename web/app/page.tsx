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
import { Button } from "@/components/Button";
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
  const [nearbyError, setNearbyError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [halalOnly, setHalalOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<NearbyItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [locating, setLocating] = useState(false);

  // Coordinates of the last loadNearby call, kept so the sheet's "Try
  // again" button can re-run it without re-prompting geolocation.
  const lastNearbyCoords = useRef<typeof KL_CENTER>(KL_CENTER);

  const loadNearby = useCallback((lat: number, lng: number) => {
    lastNearbyCoords.current = { lat, lng };
    setLoading(true);
    setNearbyError(false);
    fetch(`/api/nearby?lat=${lat}&lng=${lng}&radius_km=${RADIUS_KM}`)
      .then((res) => {
        if (!res.ok) throw new Error(`nearby ${res.status}`);
        return res.json();
      })
      .then((data: { items?: NearbyItem[] }) => setItems(data.items ?? []))
      .catch(() => {
        setNearbyError(true);
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const retryNearby = useCallback(() => {
    loadNearby(lastNearbyCoords.current.lat, lastNearbyCoords.current.lng);
  }, [loadNearby]);

  // Debounced KL-wide search: when `query` is non-empty, hit /api/search
  // instead of just filtering the ~11 already-loaded nearby items. An
  // incrementing request id guards against an older, slower response
  // clobbering a newer one.
  const searchRequestId = useRef(0);
  const trimmedQuery = query.trim();

  const hadQueryRef = useRef(false);
  // Bump to re-run the search below without waiting for `query` to change —
  // powers the error state's "Try again" button.
  const [searchRetryNonce, setSearchRetryNonce] = useState(0);

  useEffect(() => {
    if (!trimmedQuery) {
      hadQueryRef.current = false;
      searchRequestId.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults(null);
      setSearching(false);
      setSearchError(false);
      return;
    }

    const id = ++searchRequestId.current;
    setSearching(true);
    setSearchError(false);
    // Only auto-open on the *first* non-empty query, not every keystroke —
    // otherwise a user who closes the sheet while still typing can never
    // get it to stay closed.
    if (!hadQueryRef.current) setSheetOpen(true);
    hadQueryRef.current = true;

    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: trimmedQuery });
      params.set("lat", String(center.lat));
      params.set("lng", String(center.lng));
      fetch(`/api/search?${params.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error(`search ${res.status}`);
          return res.json();
        })
        .then((data: { items?: NearbyItem[] }) => {
          if (searchRequestId.current !== id) return; // stale response
          setSearchResults(data.items ?? []);
        })
        .catch(() => {
          if (searchRequestId.current !== id) return;
          setSearchError(true);
          setSearchResults([]);
        })
        .finally(() => {
          if (searchRequestId.current === id) setSearching(false);
        });
    }, 250);

    return () => clearTimeout(timer);
    // center is intentionally omitted: re-centering shouldn't re-fire an
    // in-flight search, only the debounce/query/retry should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery, searchRetryNonce]);

  const retrySearch = useCallback(() => setSearchRetryNonce((n) => n + 1), []);

  const isSearchActive = trimmedQuery.length > 0;

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUsingFallback(true);
      setCenter(KL_CENTER);
      setRecenterNonce((n) => n + 1);
      loadNearby(KL_CENTER.lat, KL_CENTER.lng);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocating(false);
        setUsingFallback(false);
        setCenter(next);
        setRecenterNonce((n) => n + 1);
        loadNearby(next.lat, next.lng);
      },
      () => {
        setLocating(false);
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

  const clearSearchAndFilters = useCallback(() => {
    setQuery("");
    setHalalOnly(false);
  }, []);

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

      {/* Top bar: search + filter + recenter FAB. Horizontal gutter comes
          from .app-column's padding-inline (which also caps/centers the
          bar at desktop widths per K7) — only vertical padding is added
          here. */}
      <div className="app-column absolute inset-x-0 top-0 z-40 flex items-center gap-2 py-gutter">
        <div className="flex min-w-0 flex-1 items-center rounded-full border border-map-outline bg-map-surface/90 py-1.5 pl-3 pr-1.5 backdrop-blur-md focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-map-mango">
          <Icon name="search" size={20} className="flex-shrink-0 text-map-on-surface" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Kuala Lumpur…"
            aria-label="Search places in Kuala Lumpur"
            data-testid="search-input"
            className="mx-2 min-w-0 flex-1 border-none bg-transparent font-body-md text-body-md text-map-on-surface placeholder:text-map-on-surface/60 focus:outline-none focus:ring-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-map-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-map-mango"
            >
              <Icon name="close" size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setHalalOnly((v) => !v)}
            aria-pressed={halalOnly}
            aria-label="Halal-friendly only"
            title="Halal-friendly only"
            data-testid="halal-toggle"
            className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-map-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-map-mango"
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
          aria-label="Recenter on my location"
          title="Recenter"
          data-testid="recenter-btn"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-map-outline bg-map-surface text-map-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-map-mango"
        >
          {locating ? (
            <span
              aria-hidden
              className="h-5 w-5 animate-spin rounded-full border-2 border-map-on-surface/30 border-t-map-on-surface"
            />
          ) : (
            <Icon name="my-location" size={20} />
          )}
        </button>
      </div>

      {usingFallback && (
        <button
          type="button"
          onClick={requestLocation}
          data-testid="browse-kl-btn"
          className="absolute left-4 top-16 z-30 flex min-h-11 items-center rounded-full bg-map-surface/90 px-3 font-label-caps text-label-caps uppercase text-map-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-map-mango"
        >
          Browse KL
        </button>
      )}

      {/* Peek card + Nearby picks CTA: stacked in one column so they never
          overlap (peek card above CTA) instead of two independently
          bottom-pinned elements. Horizontal gutter/cap via .app-column, as
          the top bar does. */}
      <div className="app-column absolute inset-x-0 bottom-24 z-30 flex flex-col gap-2">
        {selectedItem && !sheetOpen && (
          <Link
            href={`/place/${selectedItem.id}`}
            data-testid="peek-card-link"
            className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-map-mango"
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

        {!sheetOpen && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            data-testid="nearby-picks-btn"
            className="flex items-center justify-between rounded-lg bg-primary-container px-5 py-3.5 font-title-md text-title-md text-on-primary-container shadow-[0_8px_24px_rgba(0,0,0,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-map-mango"
          >
            <span>{isSearchActive ? "Results" : "Nearby picks"}</span>
            <span className="text-sm font-semibold">
              {loading || searching ? "…" : `${filteredItems.length}${isSearchActive ? "" : " nearby"}`}
            </span>
          </button>
        )}
      </div>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={isSearchActive ? "Results" : "Nearby picks"}
      >
        <p className="mb-3 -mt-1 font-body-md text-sm text-sheet-on-surface-muted">
          {isSearchActive ? `Results for '${trimmedQuery}'` : `Recent mentions · within ${RADIUS_KM} km`}
        </p>

        {/* Loading: skeleton rows (thumb + two text lines) instead of a
            bare "Loading…" line, so the list doesn't pop in shapeless. */}
        {(loading || searching) && (
          <div className="space-y-2 pb-4" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex animate-pulse gap-4 rounded-lg p-2">
                <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-sheet-surface-low" />
                <div className="min-w-0 flex-1 space-y-2 py-1">
                  <div className="h-4 w-2/3 rounded bg-sheet-surface-low" />
                  <div className="h-3 w-1/2 rounded bg-sheet-surface-low" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error: distinct from the genuine empty state below — a failed
            fetch never renders as "no places". */}
        {!loading && !searching && (isSearchActive ? searchError : nearbyError) && (
          <div className="rounded-lg border border-error-container bg-error-container p-5 text-center">
            <p className="font-title-md text-title-md text-on-error-container">Couldn&apos;t load places</p>
            <p className="mt-1 text-sm text-on-error-container">Check your connection and try again.</p>
            <Button
              type="button"
              variant="secondary"
              onClick={isSearchActive ? retrySearch : retryNearby}
              className="mt-3 !border-on-error-container !text-on-error-container"
            >
              Try again
            </Button>
          </div>
        )}

        {!loading &&
          !searching &&
          !(isSearchActive ? searchError : nearbyError) &&
          filteredItems.length === 0 &&
          (halalOnly && !isSearchActive ? (
            // F1: honest, specific copy for the halal-filter dead end — most
            // places in the current dataset are halal_status "unknown"
            // (never confirmed), not non-halal, so the generic "no results"
            // copy would wrongly read as "BiteMap has no coverage here".
            <div className="rounded-lg border border-sheet-outline bg-sheet-surface-low p-5 text-center">
              <p className="font-title-md text-title-md text-tertiary-dark">
                No halal-confirmed places nearby yet
              </p>
              <p className="mt-1 text-sm text-sheet-on-surface-muted">
                We only mark a place halal once it&apos;s confirmed. Most spots here
                haven&apos;t been checked yet.
              </p>
              <Button
                type="button"
                onClick={() => setHalalOnly(false)}
                data-testid="show-all-places-btn"
                className="mt-3"
              >
                Show all places
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-sheet-outline bg-sheet-surface-low p-5 text-center">
              <p className="font-title-md text-title-md text-tertiary-dark">
                {isSearchActive ? `No places match '${trimmedQuery}'` : "No places nearby"}
              </p>
              <p className="mt-1 text-sm text-sheet-on-surface-muted">
                {isSearchActive ? "Try a different search term." : "Try clearing search or filters."}
              </p>
              {(isSearchActive || halalOnly) && (
                <Button type="button" variant="secondary" onClick={clearSearchAndFilters} className="mt-3">
                  Clear search and filters
                </Button>
              )}
            </div>
          ))}

        <div className="space-y-2 pb-4">
          {filteredItems.map((item) => (
            <Link
              key={item.id}
              href={`/place/${item.id}`}
              data-testid="sheet-item"
              data-place-name={item.name}
              className={`-mx-2 flex gap-4 rounded-lg p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
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
