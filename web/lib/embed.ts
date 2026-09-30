// In-app video playback: build an embeddable player URL for a post, or null
// when the platform can't be framed (verified facts in the task brief —
// TikTok's official player and Instagram's /embed/ endpoint are both
// frameable; anything else keeps linking out to the original post).

export type EmbeddablePlatform = "tiktok" | "instagram";

export function isEmbeddablePlatform(platform: string): platform is EmbeddablePlatform {
  return platform === "tiktok" || platform === "instagram";
}

// TikTok official embed player params (verified 200, no X-Frame-Options /
// frame-ancestors restriction): autoplay + full controls, no extra chrome.
const TIKTOK_PLAYER_PARAMS =
  "autoplay=1&controls=1&progress_bar=1&play_button=1&volume_control=1&fullscreen_button=1&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=1";

function tiktokEmbedUrl(postUrl: string): string | null {
  const match = postUrl.match(/\/video\/(\d+)/);
  if (!match) return null;
  return `https://www.tiktok.com/player/v1/${match[1]}?${TIKTOK_PLAYER_PARAMS}`;
}

function instagramEmbedUrl(postUrl: string): string | null {
  const match = postUrl.match(/\/(reel|p)\/([^/?#]+)/);
  if (!match) return null;
  const [, kind, shortcode] = match;
  return `https://www.instagram.com/${kind}/${shortcode}/embed/`;
}

/**
 * Pure helper: given a post's platform + its stored post_url, returns the
 * in-app embeddable player URL, or null when this platform/URL shape can't
 * be embedded (caller should keep linking out in that case).
 */
export function embedUrlFor(platform: string, postUrl: string): string | null {
  if (platform === "tiktok") return tiktokEmbedUrl(postUrl);
  if (platform === "instagram") return instagramEmbedUrl(postUrl);
  return null;
}

/**
 * A post card's click handler should only intercept a plain, unmodified
 * left click — Cmd/Ctrl/Shift/Alt-click, middle-click, etc. all mean "open
 * it the normal way" (new tab/window) and must fall through to the
 * anchor's default behaviour.
 */
export function isPlainLeftClick(e: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
}): boolean {
  return !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0;
}
