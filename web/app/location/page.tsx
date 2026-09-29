"use client";

// Location-onboarding step (frontend/location.html target layout): a clean
// white card over a dimmed backdrop, offering "Use my location" (browser
// geolocation, then on to the map with lat/lng query params) or "Browse KL"
// (straight to the map, no coords — the map falls back to the KL centroid).
// Guarded by middleware (signed-in only); this is where /auth/callback sends
// first-time users post-login.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/icons";

export default function LocationPage() {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToMap(coords?: { lat: number; lng: number }, fallback?: boolean) {
    if (!coords) {
      router.push(fallback ? "/?fallback=1" : "/");
      return;
    }
    const params = new URLSearchParams({
      lat: String(coords.lat),
      lng: String(coords.lng),
    });
    router.push(`/?${params.toString()}`);
  }

  function handleUseLocation() {
    if (!navigator.geolocation) {
      goToMap();
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        goToMap({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Denied / unavailable → fall back to the KL centroid, same as
        // "Browse KL". lat/lng are only ever a query param on the map, never
        // persisted server-side. `?fallback=1` carries the notice through to
        // the map so it isn't announced here and immediately navigated away
        // from with nothing shown for it.
        setLocating(false);
        setError("Couldn't get your location — browsing KL instead.");
        goToMap(undefined, true);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  return (
    <main className="relative flex min-h-dvh w-full flex-1 items-center justify-center overflow-hidden bg-map-background px-margin-mobile py-8">
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-map-surface via-map-background to-map-background"
      />
      <div aria-hidden className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_30%_20%,theme(colors.map-outline)_0,transparent_55%)]" />

      <Card className="relative z-10 w-full max-w-md p-sheet-padding text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
          <Icon name="map" size={28} />
        </div>
        <h1 className="mb-3 font-headline-sheet text-headline-sheet text-sheet-on-surface">
          Find the real heat
        </h1>
        <p className="mx-auto mb-8 max-w-xs font-body-md text-body-md text-sheet-on-surface-muted">
          BiteMap uses your location to show what&rsquo;s actually legit
          nearby.
        </p>

        {error && (
          <p className="mb-4 text-sm text-sheet-on-surface-muted" role="status">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="primary"
            className="w-full"
            loading={locating}
            onClick={handleUseLocation}
          >
            Use my location
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={locating}
            onClick={() => goToMap()}
          >
            Browse KL
          </Button>
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center px-2 text-sm text-sheet-on-surface-muted underline underline-offset-2"
        >
          Back to map
        </Link>
      </Card>
    </main>
  );
}
