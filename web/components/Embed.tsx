"use client";

import type { MouseEvent, ReactNode } from "react";
import type { Post } from "@/lib/types";
import { embedUrlFor, isPlainLeftClick } from "@/lib/embed";
import { ImgWithFallback } from "./ImgWithFallback";

export type EmbedProps = {
  post: Post;
  /**
   * Called instead of following the link when a normal (unmodified,
   * left-button) click lands on an embeddable post — opens the in-app
   * player sheet. Omitted or platform not embeddable: the card just links
   * out to the original post, as before.
   */
  onOpen?: (post: Post, embedUrl: string) => void;
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

// Rounded-square badge standing in for the source platform's own app icon —
// used on the no-thumbnail fallback card (L1) so a missing thumbnail still
// reads as "this links out to a post on <platform>", not a blank box or the
// wrong platform's mark. The outer rounded-square frame matches across
// platforms (same stroke/size tokens); the mark inside is platform-specific.
// Unknown/missing platform falls back to a neutral link-out glyph.
export function SourceGlyph({
  platform,
  className = "",
}: {
  platform?: string;
  className?: string;
}) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
      className={className}
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      {platform === "instagram" && (
        <>
          <circle cx="12" cy="12" r="3.4" />
          <circle cx="16.6" cy="7.4" r="0.9" fill="currentColor" stroke="none" />
        </>
      )}
      {platform === "tiktok" && (
        <path
          d="M15 7.2c.35 1.7 1.45 2.75 3 2.95v1.85a5.4 5.4 0 0 1-2.9-.95v3.75a3.55 3.55 0 1 1-3.55-3.55c.12 0 .24 0 .35.02v1.9a1.65 1.65 0 1 0 1.2 1.59V7.2H15z"
          fill="currentColor"
          stroke="none"
        />
      )}
      {platform === "youtube" && (
        <path d="M10.3 9.4v5.2l4.5-2.6-4.5-2.6z" fill="currentColor" stroke="none" />
      )}
      {platform !== "instagram" && platform !== "tiktok" && platform !== "youtube" && (
        <path d="M9.5 14.5 14.5 9.5M14.5 9.5h-3M14.5 9.5v3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

// design.md §5 Embeds: rounded 16px, contained in the sheet, never edge-to-
// edge. MVP is thumbnail + link-out only — no live iframes (no CSP frame-src
// needed). Tapping opens the original post in a new tab.
// Small dark scrim chip that sits on top of a thumbnail image — shared by
// the platform-glyph corner badge below.
function ThumbnailScrim({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`absolute flex items-center justify-center rounded-md bg-black/45 text-white backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

// Centered play-triangle affordance for reel thumbnails. aria-hidden: the
// anchor already carries the accessible name via the handle/caption text.
function PlayBadge() {
  return (
    <div
      aria-hidden
      className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M8 5.5v13l11-6.5-11-6.5z" />
      </svg>
    </div>
  );
}

export function Embed({ post, onOpen }: EmbedProps) {
  const platformLabel = PLATFORM_LABELS[post.platform] ?? post.platform;
  const isReel = post.media_kind === "reel";
  const actionLabel = isReel ? "Watch reel" : "View post";

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!onOpen || !isPlainLeftClick(e)) return;
    const embedUrl = embedUrlFor(post.platform, post.post_url);
    if (!embedUrl) return;
    e.preventDefault();
    onOpen(post, embedUrl);
  }

  return (
    <a
      href={post.post_url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="post-card-link"
      data-platform={post.platform}
      onClick={handleClick}
      className="mb-2 block overflow-hidden rounded-lg border border-sheet-outline bg-sheet-surface-low p-2.5"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="font-title-md text-sm text-sheet-on-surface">
          {post.creator.handle ?? platformLabel}
        </span>
        {post.is_sponsored && (
          <span className="rounded bg-[#FFF3E0] px-1.5 py-0.5 font-label-caps text-[10px] uppercase text-[#E65100]">
            Sponsored
          </span>
        )}
        <span className="ml-auto font-label-caps text-[11px] uppercase text-sheet-on-surface-muted">
          {platformLabel}
        </span>
      </div>

      {/* Reels are 9:16 TikTok/IG cover frames — a wide landscape crop cuts
          off the subject and gives no hint the card is a video. Render
          those in a capped-width portrait frame with a play affordance and
          platform glyph baked into the thumbnail itself; non-reel posts
          keep the original wide crop. */}
      <div className={isReel ? "relative mx-auto aspect-[4/5] w-3/5 max-h-[320px] overflow-hidden rounded-lg" : "relative"}>
        <ImgWithFallback
          src={post.thumbnail_url}
          alt=""
          loading="lazy"
          className={
            isReel
              ? "h-full w-full rounded-lg object-cover object-[center_30%] transition-transform duration-200 motion-reduce:transition-none"
              : "h-28 w-full rounded-lg object-cover"
          }
          overlay={
            isReel ? (
              <>
                <PlayBadge />
                <ThumbnailScrim className="left-2 top-2 h-7 w-7">
                  <SourceGlyph platform={post.platform} className="h-4 w-4" />
                </ThumbnailScrim>
              </>
            ) : undefined
          }
          // L1: a blank white box reads as broken, not "no preview available".
          // A tinted, glyph-led card makes the fallback look intentional and
          // still names the action ("Watch reel" / "View post") the tap does.
          fallback={
            <div
              className={
                isReel
                  ? "flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-lg bg-primary-container/10 text-primary"
                  : "flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg bg-primary-container/10 text-primary"
              }
            >
              <SourceGlyph platform={post.platform} />
              <span className="font-label-caps text-[11px] text-sheet-on-surface-muted">
                {actionLabel} on {platformLabel}
              </span>
            </div>
          }
        />
      </div>

      {post.content_summary && (
        <p className="mt-2 font-body-md text-[12px] leading-relaxed text-sheet-on-surface-muted">
          {post.content_summary}
        </p>
      )}
    </a>
  );
}
