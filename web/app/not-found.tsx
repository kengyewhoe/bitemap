import { Nav } from "@/components/Nav";
import { Button } from "@/components/Button";

// Branded 404 for both notFound() throws and genuinely unmatched routes
// (Next.js routes any URL that matches no segment here — see
// app/api-reference/file-conventions/not-found). Root-level, so it inherits
// the theme script + fonts from app/layout.tsx and needs no html/body of
// its own.
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-sheet-background px-gutter pb-28 text-center text-sheet-on-surface">
      <h1 className="font-headline-sheet text-headline-sheet">Page not found</h1>
      <p className="max-w-xs font-body-md text-body-md text-sheet-on-surface-muted">
        This page doesn&apos;t exist, or it moved.
      </p>
      <Button href="/" className="mt-2">
        Back to map
      </Button>
      <Nav active="map" />
    </main>
  );
}
