// Inline SVG icon set standing in for Material Symbols Outlined.
//
// Why SVG instead of the icon font: the legacy frontend pulled Material
// Symbols from Google Fonts CSS (a render-blocking external <link>, banned
// here). next/font/google does not offer the Material Symbols family, and
// self-hosting it via next/font/local would mean vendoring a large variable
// woff2 asset — a real new-file/build-risk footprint for a component-kit
// task that's supposed to add nothing. A handful of hand-drawn 24x24
// outline SVGs covers every icon this kit currently needs, matches the
// Material Symbols "outlined" look closely enough, supports the same
// `filled` toggle Material Symbols does via FILL, and costs zero bytes of
// new dependency or font asset.
import type { SVGProps } from "react";

export type IconName =
  | "map"
  | "group"
  | "bookmark"
  | "person"
  | "chevron-down";

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  filled?: boolean;
  size?: number;
};

export function Icon({ name, filled = false, size = 24, ...rest }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    ...rest,
  };

  switch (name) {
    case "map":
      return (
        <svg {...common} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
          <path
            d="M9 3.5 3.5 5.6v14.9L9 18.4l6 2.1 5.5-2.1V3.5L15 5.6l-6-2.1Z"
            strokeLinejoin="round"
            fill={filled ? "currentColor" : "none"}
          />
          {!filled && <path d="M9 3.5v14.9M15 5.6v14.9" strokeLinejoin="round" />}
        </svg>
      );
    case "group":
      return (
        <svg {...common} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
          <circle cx="8.5" cy="8" r="3" />
          <circle cx="16" cy="9" r="2.4" />
          <path d="M3 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
          <path d="M14.5 15.2c2.4.2 4.5 2 4.5 4.3" strokeLinecap="round" />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...common} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
          <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-3.8L5.5 21V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
        </svg>
      );
    case "person":
      return (
        <svg {...common} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5" strokeLinecap="round" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}
