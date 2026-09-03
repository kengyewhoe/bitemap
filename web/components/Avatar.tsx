// Creator avatar with a graceful initials fallback. `avatar_url` is null for
// creators whose Instagram profile pic hasn't been fetched into Storage yet
// (see seed/PLAYBOOK.md), so we never render an empty circle — we show the
// creator's initials on a deterministic tinted background instead.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic tint per creator so the same person always gets the same
// color across list/detail views. Palette pulls from design.md pin accents.
const TINTS = [
  "bg-map-mango/20 text-map-mango",
  "bg-map-chili/20 text-map-chili",
  "bg-map-lime/25 text-map-lime",
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
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`h-full w-full object-cover ${className}`} />
    );
  }
  return (
    <div
      aria-hidden
      className={`flex h-full w-full items-center justify-center font-title-md ${tintFor(seed ?? name)} ${className}`}
    >
      {initials(name)}
    </div>
  );
}

export default Avatar;
