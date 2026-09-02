"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pin } from "@/components/Pin";
import { GoodBad, type GoodBadValue } from "@/components/GoodBad";
import { BottomSheet, type BottomSheetSnap } from "@/components/BottomSheet";
import { Nav, type NavTab } from "@/components/Nav";

// Visual proof page for W0-8's component kit. Not part of the product
// nav flow (Nav below is one of the states under test, not real page
// chrome) — renders every component in every documented state so the
// Tailwind v4 `@config` token bridge can be eye-checked against
// design.md's hex values directly in the browser.
export default function DevComponentsPage() {
  const [navTab, setNavTab] = useState<NavTab>("map");
  const [sheetOpen, setSheetOpen] = useState(true);
  const [sheetSnap, setSheetSnap] = useState<BottomSheetSnap>("peek");

  const [voteUnvoted, setVoteUnvoted] = useState<GoodBadValue>(null);
  const [voteVoted, setVoteVoted] = useState<GoodBadValue>("good");
  const [voteLocked] = useState<GoodBadValue>("bad");

  return (
    <main className="min-h-screen bg-surface pb-40">
      <div className="mx-auto max-w-2xl space-y-10 px-margin-mobile py-margin-mobile">
        <header>
          <h1 className="font-headline-sheet text-headline-sheet text-on-surface">
            Component kit — dev preview
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            W0-8 shared component kit. Every state, one page.
          </p>
        </header>

        {/* Buttons */}
        <section className="space-y-3">
          <h2 className="font-title-md text-title-md text-tertiary-dark">Button</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Directions</Button>
            <Button variant="secondary">Browse KL</Button>
            <Button variant="primary" loading>
              Submitting
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
            <Button variant="primary" href="#" className="no-underline">
              Link button
            </Button>
          </div>
        </section>

        {/* Card */}
        <section className="space-y-3">
          <h2 className="font-title-md text-title-md text-tertiary-dark">Card</h2>
          <Card>
            <h3 className="font-headline-sheet text-headline-sheet text-tertiary-dark">
              Since Then Kopitiam
            </h3>
            <p className="font-body-md text-body-md text-sheet-on-surface-muted">
              Petaling Street · 1.2 km
            </p>
          </Card>
        </section>

        {/* Pin */}
        <section className="space-y-3">
          <h2 className="font-title-md text-title-md text-tertiary-dark">Pin</h2>
          <div className="flex items-end gap-8 rounded-xl bg-map-background p-6">
            <Pin heat="high" label="Chili" />
            <Pin heat="medium" label="Mango" />
            <Pin heat="low" label="Lime" />
            <Pin heat="medium" selected label="Selected" />
          </div>
        </section>

        {/* GoodBad */}
        <section className="space-y-3">
          <h2 className="font-title-md text-title-md text-tertiary-dark">GoodBad</h2>
          <Card className="space-y-2">
            <p className="font-label-caps text-label-caps text-sheet-on-surface-muted">
              Unvoted
            </p>
            <GoodBad value={voteUnvoted} onVote={setVoteUnvoted} />
          </Card>
          <Card className="space-y-2">
            <p className="font-label-caps text-label-caps text-sheet-on-surface-muted">
              Voted (interactive)
            </p>
            <GoodBad
              value={voteVoted}
              onVote={setVoteVoted}
              goodPct={72}
              totalRatings={38}
            />
          </Card>
          <Card className="space-y-2">
            <p className="font-label-caps text-label-caps text-sheet-on-surface-muted">
              Locked (post-submit)
            </p>
            <GoodBad value={voteLocked} locked goodPct={null} totalRatings={3} />
          </Card>
        </section>

        {/* Bottom sheet */}
        <section className="space-y-3">
          <h2 className="font-title-md text-title-md text-tertiary-dark">BottomSheet</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setSheetOpen((v) => !v)}>
              {sheetOpen ? "Close sheet" : "Open sheet"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSheetSnap((s) => (s === "expanded" ? "peek" : "expanded"))}
            >
              Snap: {sheetSnap}
            </Button>
          </div>
        </section>

        {/* Nav */}
        <section className="space-y-3">
          <h2 className="font-title-md text-title-md text-tertiary-dark">Nav</h2>
          <div className="flex gap-2">
            {(["map", "influencers", "saved", "me"] as NavTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setNavTab(tab)}
                className={`rounded-lg border border-sheet-outline px-3 py-1.5 text-sm ${
                  navTab === tab ? "bg-primary-container text-on-primary" : "text-sheet-on-surface-muted"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Nav is rendered fixed at the bottom of this page — set active via the buttons above.
          </p>
        </section>
      </div>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        snap={sheetSnap}
        onSnapChange={setSheetSnap}
        title="Since Then Kopitiam"
      >
        <p className="font-body-md text-body-md text-sheet-on-surface-muted">
          Petaling Street · 1.2 km · @klfoodie
        </p>
        <div className="mt-4">
          <GoodBad value={null} goodPct={64} totalRatings={12} />
        </div>
      </BottomSheet>

      <Nav active={navTab} />
    </main>
  );
}
