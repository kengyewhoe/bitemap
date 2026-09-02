import { Nav } from "@/components/Nav";

// Wave 2 stub — the real influencers screen lands later. This just keeps
// the tab bar from 404ing. /influencers is not in the middleware guard
// list, so it's reachable while signed out.
export default function InfluencersPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-sheet-background px-gutter pb-28 text-center text-sheet-on-surface">
      <h1 className="font-headline-sheet text-headline-sheet">Influencers</h1>
      <p className="font-body-md text-body-md text-sheet-on-surface-muted">
        Coming soon.
      </p>
      <Nav active="influencers" />
    </main>
  );
}
