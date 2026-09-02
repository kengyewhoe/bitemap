import { Nav } from "@/components/Nav";

// Wave 2 stub — the real saved-places screen lands later. This just keeps
// the tab bar from 404ing. /saved is in the middleware guard list, so this
// only ever renders for a signed-in user.
export default function SavedPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-sheet-background px-gutter pb-28 text-center text-sheet-on-surface">
      <h1 className="font-headline-sheet text-headline-sheet">Saved</h1>
      <p className="font-body-md text-body-md text-sheet-on-surface-muted">
        Coming soon.
      </p>
      <Nav active="saved" />
    </main>
  );
}
