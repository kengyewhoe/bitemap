import type { Post } from "@/lib/types";

export type EmbedProps = {
  post: Post;
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

// design.md §5 Embeds: rounded 16px, contained in the sheet, never edge-to-
// edge. MVP is thumbnail + link-out only — no live iframes (no CSP frame-src
// needed). Tapping opens the original post in a new tab.
export function Embed({ post }: EmbedProps) {
  const platformLabel = PLATFORM_LABELS[post.platform] ?? post.platform;

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

      {post.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.thumbnail_url}
          alt=""
          className="h-28 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg bg-sheet-surface text-sheet-on-surface-muted">
          <span className="font-label-caps text-[11px]">
            {post.media_kind === "reel" ? "Reel" : "Post"} on {platformLabel}
          </span>
        </div>
      )}

      {post.content_summary && (
        <p className="mt-2 font-body-md text-[12px] leading-relaxed text-sheet-on-surface-muted">
          {post.content_summary}
        </p>
      )}
    </a>
  );
}
