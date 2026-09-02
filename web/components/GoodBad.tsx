"use client";

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
export function GoodBad({
  value,
  onVote,
  disabled = false,
  locked = false,
  goodPct = null,
  totalRatings,
}: GoodBadProps) {
  const isLocked = disabled || locked;

  return (
    <div className="w-full">
      <div className="mb-3 flex rounded-xl border border-sheet-outline bg-sheet-surface-low p-1">
        <button
          type="button"
          disabled={isLocked}
          aria-pressed={value === "good"}
          onClick={() => onVote?.("good")}
          className={`flex-1 rounded-lg py-3 font-title-md text-sm transition-colors disabled:cursor-not-allowed ${
            value === "good"
              ? "bg-sheet-surface text-sheet-on-surface shadow-sm"
              : "text-sheet-on-surface-muted"
          }`}
        >
          Good
        </button>
        <button
          type="button"
          disabled={isLocked}
          aria-pressed={value === "bad"}
          onClick={() => onVote?.("bad")}
          className={`flex-1 rounded-lg py-3 font-title-md text-sm transition-colors disabled:cursor-not-allowed ${
            value === "bad"
              ? "bg-sheet-surface text-sheet-on-surface shadow-sm"
              : "text-sheet-on-surface-muted"
          }`}
        >
          Bad
        </button>
      </div>

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
