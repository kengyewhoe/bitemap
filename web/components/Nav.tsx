"use client";

import Link from "next/link";
import { Icon, type IconName } from "./icons";

export type NavTab = "map" | "influencers" | "saved" | "me";

const TABS: { id: NavTab; href: string; icon: IconName; label: string }[] = [
  { id: "map", href: "/", icon: "map", label: "Map" },
  { id: "influencers", href: "/influencers", icon: "group", label: "Influencers" },
  { id: "saved", href: "/saved", icon: "bookmark", label: "Saved" },
  { id: "me", href: "/me", icon: "person", label: "Me" },
];

export type NavProps = {
  active: NavTab;
};

// Ported from frontend/js/nav.js — same tab list, same sheet-surface /
// sheet-outline chrome and label-caps type, same "primary + scale + filled
// icon" active state. Uses Next <Link> instead of raw <a> for client-side
// nav.
export function Nav({ active }: NavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 min-h-20 w-full rounded-t-xl border-t border-sheet-outline bg-sheet-surface pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
      {/* R6: the bar background stays full-width, but the tab row is
          constrained to the same centered column as page content so tabs
          don't spread across the full desktop viewport. */}
      <div className="app-column flex min-h-20 items-center justify-around">
        {TABS.map((tab) => {
          const on = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              data-testid={`nav-${tab.id}`}
              aria-current={on ? "page" : undefined}
              className={`relative flex h-16 w-16 flex-col items-center justify-center rounded-xl transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                on ? "scale-105 font-bold text-primary" : "text-on-surface-variant"
              }`}
            >
              {on && (
                <span className="absolute top-0 h-[3px] w-8 rounded-full bg-primary" aria-hidden />
              )}
              <Icon name={tab.icon} filled={on} size={22} className="mb-1" />
              <span className="font-label-caps text-label-caps">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
