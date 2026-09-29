"use client";

import { useState } from "react";

export type GoodBadValue = "good" | "bad" | null;

export type GoodBadProps = {
  value: GoodBadValue;
  onVote?: (value: "good" | "bad") => void;
  disabled?: boolean;
  /** Lock after submit: control still shows the chosen vote, but no longer accepts input. */
  locked?: boolean;
  /** 0-100, or null when under the reveal threshold (rate.html: <5 ratings shows "Baru", never "null%"). */
  goodPct?: number | null;
  totalRatings?: number;
};

// design.md §5 Rating: segmented Good | Bad control, NOT a stamp. Ported
// layout from frontend/rate.html (bg-sheet-surface-low pill container,
// bg-sheet-surface + shadow-sm on the active segment). Post-vote percent
// renders in mint (`secondary` / `secondary-container`), Be Vietnam Pro —
// never Anton, never a chili "HYPE" slap.
//
// Two-step confirm (persona-findings.md F3): the vote is unrecoverable (no
// update/delete path), so a first tap on Good/Bad only *selects* it and
// swaps the segmented control for an inline confirm row — onVote only fires
// once Confirm is tapped. Cancel returns to the neutral segmented control
// without writing anything.
function VoteSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function GoodBad({
  value,
  onVote,
  disabled = false,
  locked = false,
  goodPct = null,
  totalRatings,
}: GoodBadProps) {
  const isLocked = disabled || locked;
  // Distinguishes the brief in-flight vote (spinner, dimmed) from the
  // permanent post-vote lock (no spinner) — both use `disabled`. `value`
  // stays null until the caller's vote round-trip resolves, so track which
  // segment was tapped locally to know where to show the spinner.
  const isPending = disabled && !locked;
  // `pressed` doubles as "awaiting confirm": set on the first tap, before
  // onVote fires. It stays set through the write (so the confirm row keeps
  // showing a spinner) and is only cleared by Cancel or once `value` lands.
  const [pressed, setPressed] = useState<GoodBadValue>(null);
  const awaitingConfirm = value === null && pressed !== null;

  function select(option: "good" | "bad") {
    setPressed(option);
  }

  function confirm() {
    if (!pressed || isPending) return;
    onVote?.(pressed);
  }

  function cancel() {
    if (isPending) return;
    setPressed(null);
  }

  return (
    <div className="w-full">
      {awaitingConfirm ? (
        <div
          className="mb-3 rounded-xl border border-sheet-outline bg-sheet-surface-low p-3"
          role="alertdialog"
          aria-label={`Confirm ${pressed === "good" ? "Good" : "Bad"} vote`}
        >
          <p className="mb-3 font-body-md text-body-md text-sheet-on-surface">
            Vote {pressed === "good" ? "Good" : "Bad"}? This can&apos;t be changed.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={isPending}
              data-testid="vote-confirm"
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary-container font-title-md text-sm text-on-primary-container transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending && <VoteSpinner />}
              Confirm
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              data-testid="vote-cancel"
              className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-sheet-outline font-title-md text-sm text-sheet-on-surface-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-label="Rate this place"
          className="mb-3 flex rounded-xl border border-sheet-outline bg-sheet-surface-low p-1"
        >
          <button
            type="button"
            role="radio"
            disabled={isLocked}
            aria-checked={value === "good"}
            onClick={() => select("good")}
            data-testid="vote-good"
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 font-title-md text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${
              value === "good"
                ? "bg-sheet-surface text-sheet-on-surface shadow-sm"
                : "text-sheet-on-surface-muted"
            }`}
          >
            Good
          </button>
          <button
            type="button"
            role="radio"
            disabled={isLocked}
            aria-checked={value === "bad"}
            onClick={() => select("bad")}
            data-testid="vote-bad"
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 font-title-md text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${
              value === "bad"
                ? "bg-sheet-surface text-sheet-on-surface shadow-sm"
                : "text-sheet-on-surface-muted"
            }`}
          >
            Bad
          </button>
        </div>
      )}

      {value !== null && (
        <div className="flex items-center gap-3 rounded-lg bg-secondary-container/20 p-3">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-secondary" />
          <p className="font-body-md text-body-md text-secondary">
            {goodPct === null ? (
              "Baru · not enough ratings yet"
            ) : (
              <>
                <strong>{goodPct}% Good</strong>
                {typeof totalRatings === "number" ? ` · ${totalRatings} ratings` : null}
              </>
            )}
          </p>
        </div>
      )}

      {locked && value !== null && (
        <p className="mt-2 font-label-caps text-label-caps text-sheet-on-surface-muted">
          Vote locked
        </p>
      )}
    </div>
  );
}
