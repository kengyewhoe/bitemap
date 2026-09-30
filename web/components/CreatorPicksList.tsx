"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { ImgWithFallback } from "./ImgWithFallback";
import { SourceGlyph } from "./Embed";
import { VideoPlayerSheet } from "./VideoPlayerSheet";
import { embedUrlFor, isPlainLeftClick } from "@/lib/embed";
import type { Post } from "@/lib/types";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export interface CreatorPostRow {
  id: string;
  platform: string;
  post_url: string;
  thumbnail_url: string | null;
  media_kind: string;
  posted_at: string;
}

export type CreatorPickRow =
  | {
      kind: "place";
      placeId: string;
      name: string;
      area: string | null;
      thumbnailUrl: string | null;
      mediaKind: string;
      count: number;
    }
  | { kind: "post"; post: CreatorPostRow };

export type CreatorPicksListProps = {
  picks: CreatorPickRow[];
  /** The creator whose profile this is — used as the player sheet's handle since these posts carry no per-post creator row. */
  creatorHandle: string | null;
};

// Minimal client boundary around the influencer page's "Curated picks" list:
// owns which post's player sheet (if any) is open, so the page itself stays
// a server component. Grouped "place" rows keep linking straight to the
// place page (unchanged); ungrouped "post" rows (no matched place) open the
// in-app player instead of leaving straight to the platform.
export function CreatorPicksList({ picks, creatorHandle }: CreatorPicksListProps) {
  const [openPost, setOpenPost] = useState<Post | null>(null);

  function handlePostClick(post: CreatorPostRow) {
    return (e: MouseEvent<HTMLAnchorElement>) => {
      if (!isPlainLeftClick(e)) return;
      const embedUrl = embedUrlFor(post.platform, post.post_url);
      if (!embedUrl) return;
      e.preventDefault();
      setOpenPost({
        id: post.id,
        platform: post.platform,
        post_url: post.post_url,
        thumbnail_url: post.thumbnail_url,
        media_kind: post.media_kind,
        posted_at: post.posted_at,
        is_sponsored: false,
        content_summary: null,
        creator: { id: null, handle: creatorHandle, display_name: null, avatar_url: null },
      });
    };
  }

  return (
    <div className="flex flex-col gap-2">
      {picks.map((pick) => {
        if (pick.kind === "place") {
          return (
            <Link key={pick.placeId} href={`/place/${pick.placeId}`} data-testid="creator-pick-link">
              <div className="flex gap-4 rounded-lg border border-sheet-outline bg-sheet-surface p-3">
                <ImgWithFallback
                  src={pick.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  fallback={
                    <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-primary-container/10 text-primary">
                      <SourceGlyph className="h-5 w-5" />
                    </div>
                  }
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-title-md text-[16px] text-sheet-on-surface">
                    {pick.name}
                  </h3>
                  <p className="mt-1 flex items-center gap-1 font-label-caps text-[11px] uppercase text-sheet-on-surface-muted">
                    {pick.area && <span className="min-w-0 truncate">{pick.area} ·</span>}
                    <span className="shrink-0">
                      {pick.count > 1 ? `${pick.count} posts` : "1 post"}
                    </span>
                  </p>
                </div>
              </div>
            </Link>
          );
        }

        const post = pick.post;
        const platformLabel = PLATFORM_LABELS[post.platform] ?? post.platform;
        const embeddable = embedUrlFor(post.platform, post.post_url) !== null;
        return (
          <a
            key={post.id}
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="post-card-link"
            data-platform={post.platform}
            onClick={handlePostClick(post)}
            className="flex gap-4 rounded-lg border border-sheet-outline bg-sheet-surface p-3"
          >
            <ImgWithFallback
              src={post.thumbnail_url}
              alt=""
              loading="lazy"
              className="h-20 w-20 shrink-0 rounded-lg object-cover"
              fallback={
                <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-primary-container/10 text-primary">
                  <SourceGlyph platform={post.platform} className="h-5 w-5" />
                </div>
              }
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-title-md text-[16px] text-sheet-on-surface">
                {platformLabel}
              </h3>
              <p className="mt-1 flex items-center gap-1 font-label-caps text-[11px] uppercase text-sheet-on-surface-muted">
                <SourceGlyph platform={post.platform} className="h-3 w-3" />
                {embeddable ? "Watch in BiteMap" : `Opens ${platformLabel}`}
              </p>
            </div>
          </a>
        );
      })}

      {openPost && <VideoPlayerSheet post={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  );
}
