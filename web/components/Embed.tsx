import type { Post } from "@/lib/types";
import { ImgWithFallback } from "./ImgWithFallback";

export type EmbedProps = {
  post: Post;
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

// Rounded-square "camera" glyph standing in for the source platform's app
// icon — used on the no-thumbnail fallback card (L1) so a missing thumbnail
// still reads as "this links out to a post", not a blank box.
export function SourceGlyph({ className = "" }: { className?: string }) {
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
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="16.6" cy="7.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

// design.md §5 Embeds: rounded 16px, contained in the sheet, never edge-to-
// edge. MVP is thumbnail + link-out only — no live iframes (no CSP frame-src
// needed). Tapping opens the original post in a new tab.
export function Embed({ post }: EmbedProps) {
  const platformLabel = PLATFORM_LABELS[post.platform] ?? post.platform;
  const actionLabel = post.media_kind === "reel" ? "Watch reel" : "View post";

  return (
    <a
      href={post.post_url}
      target="_blank"
      rel="noopener noreferrer"
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

      <ImgWithFallback
        src={post.thumbnail_url}
        alt=""
        loading="lazy"
        className="h-28 w-full rounded-lg object-cover"
        // L1: a blank white box reads as broken, not "no preview available".
        // A tinted, glyph-led card makes the fallback look intentional and
        // still names the action ("Watch reel" / "View post") the tap does.
        fallback={
          <div className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg bg-primary-container/10 text-primary">
            <SourceGlyph />
            <span className="font-label-caps text-[11px] text-sheet-on-surface-muted">
              {actionLabel} on {platformLabel}
            </span>
          </div>
        }
      />

      {post.content_summary && (
        <p className="mt-2 font-body-md text-[12px] leading-relaxed text-sheet-on-surface-muted">
          {post.content_summary}
        </p>
      )}
    </a>
  );
}
