"use client";

import { useEffect } from "react";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/Button";

// Route-segment error boundary: wraps every page under the root layout, so
// a render throw (e.g. supabase.auth.getUser() rejecting) shows this
// instead of Next's raw error screen. Still rendered inside app/layout.tsx's
// html/body, so it can use app components and tokens directly.
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-sheet-background px-gutter pb-28 text-center text-sheet-on-surface">
      <h1 className="font-headline-sheet text-headline-sheet">Something went wrong</h1>
      <p className="max-w-xs font-body-md text-body-md text-sheet-on-surface-muted">
        This page hit an unexpected error. It may just be a hiccup.
      </p>
      <Button type="button" onClick={retry} className="mt-2">
        Try again
      </Button>
      <Nav active="map" />
    </main>
  );
}
