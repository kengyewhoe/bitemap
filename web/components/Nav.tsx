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
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 w-full items-center justify-around rounded-t-xl border-t border-sheet-outline bg-sheet-surface px-4 pb-[env(safe-area-inset-bottom,16px)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
      {TABS.map((tab) => {
        const on = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl transition-transform ${
              on ? "scale-105 font-bold text-primary" : "text-on-surface-variant"
            }`}
          >
            <Icon name={tab.icon} filled={on} size={22} className="mb-1" />
            <span className="font-label-caps text-label-caps">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
