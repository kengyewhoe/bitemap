"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export type BottomSheetSnap = "peek" | "expanded";

export type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which snap point is active. Omit for a sheet with only one resting height. */
  snap?: BottomSheetSnap;
  onSnapChange?: (snap: BottomSheetSnap) => void;
  title?: string;
  children: ReactNode;
  /** Render a backdrop behind the sheet (dims the map). Defaults to true. */
  backdrop?: boolean;
};

// design.md §5 Bottom sheet: white, 24px top radius (`rounded-t-xl`), 24px
// padding (`p-sheet-padding`), grabber, `sheet-outline` border, syncs with
// the selected mango pin. Hand-rolled (no vaul/radix) — layout ported from
// frontend/home.html's #sheet/#sheet-handle markup, with two snap heights
// (peek ~ compact name/area/score row per design.md §4, expanded ~68vh
// matching the legacy `h-[68vh]` sheet) instead of the legacy's
// show/hide-only panel.
export function BottomSheet({
  open,
  onOpenChange,
  snap = "expanded",
  onSnapChange,
  title,
  children,
  backdrop = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  // Focus the sheet on open (restoring focus to whatever triggered it on
  // close), and lock body scroll while open so the map/page behind it
  // doesn't scroll — this is a modal dialog (role="dialog" aria-modal).
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      sheetRef.current?.focus();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
    previouslyFocused.current?.focus();
    previouslyFocused.current = null;
  }, [open]);

  function toggleSnap() {
    // With no onSnapChange, the sheet has only one resting height — the
    // grabber's job is then simply to close it, not a no-op.
    if (!onSnapChange) {
      onOpenChange(false);
      return;
    }
    onSnapChange(snap === "expanded" ? "peek" : "expanded");
  }

  return (
    <>
      {backdrop && (
        <div
          aria-hidden
          onClick={() => onOpenChange(false)}
          className={`fixed inset-0 z-40 bg-map-background/60 backdrop-blur-sm transition-opacity duration-200 ${
            open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
      )}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        // `inert` (not just visual translate-y-full) so a closed sheet's
        // links drop out of the tab order and stop being read by screen
        // readers — visibility:hidden would also work but `inert` keeps
        // the slide-shut transition intact. tabIndex -1 lets the open
        // effect above focus the sheet's own dialog container.
        inert={!open ? true : undefined}
        tabIndex={-1}
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-t-xl border border-sheet-outline bg-sheet-surface shadow-[0_-4px_24px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-out focus:outline-none ${
          open ? "translate-y-0" : "translate-y-full"
        } ${snap === "expanded" ? "h-[68vh]" : "h-[168px]"}`}
      >
        <button
          type="button"
          onClick={toggleSnap}
          data-testid="sheet-grabber"
          aria-label={onSnapChange ? (snap === "expanded" ? "Collapse sheet" : "Expand sheet") : "Close sheet"}
          className="flex h-11 w-full flex-shrink-0 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        >
          <span className="h-1.5 w-12 rounded-full bg-sheet-on-surface-muted/30" />
        </button>

        {title && (
          <div className="flex-shrink-0 px-sheet-padding pb-2">
            <h2 className="font-headline-sheet text-headline-sheet text-sheet-on-surface">{title}</h2>
          </div>
        )}

        <div
          // Bottom padding clears the fixed Nav bar (h-20 = 80px, rendered
          // after the sheet, z-50) so the last list row isn't hidden behind
          // it, plus the safe-area inset on notched phones.
          className="flex-1 overflow-y-auto px-sheet-padding pb-[calc(80px+env(safe-area-inset-bottom,0px))]"
        >
          {children}
        </div>
      </div>
    </>
  );
}
