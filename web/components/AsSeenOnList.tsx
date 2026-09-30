"use client";

import { useState } from "react";
import { Embed } from "./Embed";
import { VideoPlayerSheet } from "./VideoPlayerSheet";
import type { Post } from "@/lib/types";

export type AsSeenOnListProps = {
  posts: Post[];
  placeName: string;
  directionsUrl: string;
};

// Minimal client boundary around the place page's "As seen on" list: owns
// which post's player sheet (if any) is open, so the place page itself can
// stay a server component. One sheet at a time — opening a card while
// another's open just swaps which post it shows.
export function AsSeenOnList({ posts, placeName, directionsUrl }: AsSeenOnListProps) {
  const [openPost, setOpenPost] = useState<Post | null>(null);

  return (
    <div>
      {posts.map((post) => (
        <Embed key={post.id} post={post} onOpen={setOpenPost} />
      ))}
      {openPost && (
        <VideoPlayerSheet
          post={openPost}
          placeName={placeName}
          directionsUrl={directionsUrl}
          onClose={() => setOpenPost(null)}
        />
      )}
    </div>
  );
}
