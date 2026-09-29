// Creator avatar with a graceful initials fallback. `avatar_url` is null for
// creators whose Instagram profile pic hasn't been fetched into Storage yet
// (see seed/PLAYBOOK.md), and a fetched URL can itself 404 (L3/C6), so we
// never render an empty circle or a broken-image glyph — we show the
// creator's initials on a deterministic tinted background instead.
import { ImgWithFallback } from "./ImgWithFallback";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic tint per creator so the same person always gets the same
// color across list/detail views. Uses the app's semantic container/on-*
// token pairs (not the fixed-hex map-* palette) — each pair is already
// tuned per theme to read at >=4.5:1 against its own container, which the
// raw map-* tints did not guarantee in light mode (L3).
const TINTS = [
  "bg-primary-container/25 text-primary",
  "bg-secondary-container/40 text-secondary",
  "bg-tertiary-container/25 text-tertiary",
];

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

export function Avatar({
  src,
  name,
  seed,
  className = "",
}: {
  src?: string | null;
  name: string;
  /** Stable id for tint selection; defaults to name. */
  seed?: string;
  className?: string;
}) {
  return (
    <ImgWithFallback
      src={src}
      alt=""
      className={`h-full w-full object-cover ${className}`}
      fallback={
        <div
          aria-hidden
          className={`flex h-full w-full items-center justify-center font-title-md ${tintFor(seed ?? name)} ${className}`}
        >
          {initials(name)}
        </div>
      }
    />
  );
}

export default Avatar;
