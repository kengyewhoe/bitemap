"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Post } from "@/lib/types";
import { embedUrlFor } from "@/lib/embed";
import { SourceGlyph } from "./Embed";
import { ImgWithFallback } from "./ImgWithFallback";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

const LOAD_TIMEOUT_MS = 8000;

// Same visual weight as the primary Button variant (components/Button.tsx),
// reproduced as a plain <a> here because this button must open the maps URL
// in a new tab (target=_blank) — Button's href variant is a same-tab
// next/link, which isn't what "Directions" from inside a video should do.
const PRIMARY_BUTTON_CLASSES =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-6 py-3.5 font-title-md text-title-md text-on-primary shadow-sm active:opacity-90";

export type VideoPlayerSheetProps = {
  post: Post;
  /** Human place name, used in the iframe's accessible title. */
  placeName?: string;
  /** Same maps URL as the place page's directions-link, when known. */
  directionsUrl?: string;
  /** /place/<id> link, shown instead of Directions when the post has a matched place but no directions URL was passed in (creator page). */
  viewPlaceHref?: string;
  onClose: () => void;
};

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-8 w-8 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function VideoPlayerSheet({
  post,
  placeName,
  directionsUrl,
  viewPlaceHref,
  onClose,
}: VideoPlayerSheetProps) {
  const embedUrl = embedUrlFor(post.platform, post.post_url);
  const platformLabel = PLATFORM_LABELS[post.platform] ?? post.platform;
  const handle = post.creator.handle ?? platformLabel;

  const [shown, setShown] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pushedHistoryRef = useRef(false);

  // Play-in transition: mount closed, flip to open on the next frame so the
  // CSS transition actually runs. prefers-reduced-motion skips straight to
  // the open state via the motion-reduce: classes below (no JS needed for
  // that part — the transition itself just becomes instant).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Back-button dismissal: push one history entry on open. Any close path
  // (X, backdrop, Escape) calls history.back() instead of onClose directly,
  // so there is exactly one place — the popstate listener — that ever tells
  // the parent to unmount this sheet. That keeps a stray double-close (e.g.
  // X clicked right as the user also swipes back) from popping two entries.
  useEffect(() => {
    // The ref guard (persists across React Strict Mode's dev-only
    // mount→cleanup→remount effect cycle, unlike component state) makes
    // sure this only ever pushes one history entry per open, however many
    // times the effect body runs.
    if (!pushedHistoryRef.current) {
      history.pushState({ videoPlayer: post.id }, "");
      pushedHistoryRef.current = true;
    }
    function onPopState() {
      onCloseRef.current();
    }
    window.addEventListener("popstate", onPopState);
    // Cleanup only ever removes the listener — it must NOT also pop history
    // here. Every real close path (X, backdrop, Escape, or the user's own
    // browser-back) already goes through history.back() -> this popstate
    // handler -> the parent unmounting us, so by the time this effect's
    // cleanup runs, the entry is already gone. Popping again here would
    // double up.
    return () => window.removeEventListener("popstate", onPopState);
  }, [post.id]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") triggerClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (loaded) return undefined;
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loaded]);

  function triggerClose() {
    history.back();
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/70 transition-opacity duration-200 motion-reduce:transition-none ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      onClick={triggerClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${handle}'s video`}
        onClick={(e) => e.stopPropagation()}
        className={`relative flex h-[100dvh] w-full max-w-md flex-col bg-black text-white transition-transform duration-200 ease-out motion-reduce:transition-none sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl ${
          shown ? "translate-y-0" : "translate-y-4"
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 px-4 py-3">
          <SourceGlyph platform={post.platform} className="h-5 w-5 text-white" />
          <span className="font-title-md text-sm text-white">{handle}</span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={triggerClose}
            aria-label="Close video"
            data-testid="player-close"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-white active:bg-white/10"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
          <div className="relative mx-auto aspect-[9/16] h-full max-h-[calc(100dvh-192px)] max-w-full sm:max-h-[calc(90dvh-192px)]">
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg bg-black">
                <ImgWithFallback
                  src={post.thumbnail_url}
                  alt=""
                  className="h-full w-full object-cover opacity-60"
                  fallback={<div className="h-full w-full bg-black" />}
                />
                {!timedOut && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner />
                  </div>
                )}
              </div>
            )}

            {embedUrl && !timedOut && (
              <iframe
                src={embedUrl}
                title={`${handle}'s video about ${placeName ?? post.content_summary ?? "this place"}`}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                loading="eager"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setLoaded(true)}
                className={`absolute inset-0 h-full w-full border-0 ${loaded ? "opacity-100" : "opacity-0"}`}
              />
            )}

            {(timedOut || !embedUrl) && !loaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
                <p className="font-body-md text-sm text-white/80">Video didn&apos;t load</p>
                <a
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-title-md text-sm font-semibold text-primary underline"
                >
                  Open in {platformLabel}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="player-directions"
              className={PRIMARY_BUTTON_CLASSES}
            >
              Directions
            </a>
          )}
          {!directionsUrl && viewPlaceHref && (
            <Link href={viewPlaceHref} className={PRIMARY_BUTTON_CLASSES} data-testid="player-view-place">
              View place
            </Link>
          )}
          <a
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="player-open-external"
            className="text-center font-body-md text-sm text-white/70 underline underline-offset-2"
          >
            Open in {platformLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
