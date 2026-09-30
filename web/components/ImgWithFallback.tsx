"use client";

import { useState } from "react";
import type { ImgHTMLAttributes, ReactNode } from "react";

export type ImgWithFallbackProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "onError"
> & {
  src: string | null | undefined;
  /** Rendered instead of the <img> when `src` is missing or fails to load. */
  fallback: ReactNode;
  /**
   * Rendered alongside the <img> only when it is actually showing (not the
   * fallback) — e.g. a play-button/platform-glyph overlay that should never
   * appear on top of the "no thumbnail" fallback card. The caller is
   * responsible for positioning (typically `absolute` within a `relative`
   * parent that wraps this component).
   */
  overlay?: ReactNode;
};

// Remote Supabase Storage / social-CDN URLs (avatars, post thumbnails, place
// photos) can be null or dead (K1/L1/L3/C6 findings) — the browser's broken-
// image glyph is never an acceptable placeholder in this app. This client
// component tracks a single `onError` flip and swaps to the caller's
// `fallback` node, which stays in the layout's own place (Avatar's tinted
// initials, Embed's "watch on Instagram" card, the place hero's icon panel).
export function ImgWithFallback({ src, fallback, overlay, alt = "", ...rest }: ImgWithFallbackProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onError={() => setFailed(true)} {...rest} />
      {overlay}
    </>
  );
}

export default ImgWithFallback;
