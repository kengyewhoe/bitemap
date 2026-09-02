"use client";

import { useState } from "react";

type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "bitemap.theme";
const OPTIONS: ThemeChoice[] = ["system", "light", "dark"];
const LABELS: Record<ThemeChoice, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

function readStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable (private mode, disabled) — fall through.
  }
  return "system";
}

function applyTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") {
      localStorage.removeItem(STORAGE_KEY);
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem(STORAGE_KEY, choice);
      document.documentElement.dataset.theme = choice;
    }
  } catch {
    // localStorage unavailable — still flip the in-page attribute so the
    // toggle works for this session even though it won't persist.
    if (choice === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = choice;
    }
  }
}

// design.md §5 touchpoint surface: sheet-surface card with sheet-outline
// hairline, matching Card.tsx. The map (page.tsx / Map.tsx) is untouched —
// this only affects app chrome / sheets via the --color-* CSS vars.
export function ThemeToggle() {
  // Lazy initializer: runs once per mount, on the client after hydration
  // (and harmlessly returns "system" during any server render, since
  // localStorage access there is caught by the try/catch in
  // readStoredTheme). Avoids a setState-in-effect render cascade.
  const [choice, setChoice] = useState<ThemeChoice>(() => readStoredTheme());

  function select(next: ThemeChoice) {
    setChoice(next);
    applyTheme(next);
  }

  return (
    <div className="rounded-lg border border-sheet-outline bg-sheet-surface p-4">
      <h3 className="mb-3 font-label-caps text-label-caps uppercase text-sheet-on-surface-muted">
        Theme
      </h3>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="flex gap-2 rounded-lg bg-sheet-surface-low p-1"
      >
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={choice === option}
            onClick={() => select(option)}
            suppressHydrationWarning
            className={`flex-1 rounded-lg py-2 font-title-md text-title-md transition-colors ${
              choice === option
                ? "bg-primary-container text-on-primary"
                : "text-sheet-on-surface-muted"
            }`}
          >
            {LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
