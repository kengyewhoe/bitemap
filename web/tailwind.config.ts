import type { Config } from "tailwindcss";

// Design tokens ported from /design.md (frontmatter) and the legacy
// frontend/js/head.html inline `tailwind.config` (Play CDN config, now
// replaced by this built config). Token names are kept identical so
// existing markup classes (bg-map-background, text-sheet-on-surface, ...)
// port over unchanged.
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Touchpoint/app tokens are wired to CSS variables (defined in
        // globals.css) so the palette can swap at runtime for the
        // light/dark theme toggle. Values below are unchanged fallbacks
        // matching the light design.md palette. `map-*` tokens stay fixed
        // hex — the map is always nocturnal, in both themes.
        surface: "var(--color-surface)",
        "surface-dim": "var(--color-surface-dim)",
        "surface-bright": "var(--color-surface-bright)",
        "surface-container-lowest": "var(--color-surface-container-lowest)",
        "surface-container-low": "var(--color-surface-container-low)",
        "surface-container": "var(--color-surface-container)",
        "surface-container-high": "var(--color-surface-container-high)",
        "surface-container-highest": "var(--color-surface-container-highest)",
        "on-surface": "var(--color-on-surface)",
        "on-surface-variant": "var(--color-on-surface-variant)",
        "inverse-surface": "var(--color-inverse-surface)",
        "inverse-on-surface": "var(--color-inverse-on-surface)",
        outline: "var(--color-outline)",
        "outline-variant": "var(--color-outline-variant)",
        "surface-tint": "var(--color-surface-tint)",
        primary: "var(--color-primary)",
        "on-primary": "var(--color-on-primary)",
        "primary-container": "var(--color-primary-container)",
        "on-primary-container": "var(--color-on-primary-container)",
        "inverse-primary": "var(--color-inverse-primary)",
        secondary: "var(--color-secondary)",
        "on-secondary": "var(--color-on-secondary)",
        "secondary-container": "var(--color-secondary-container)",
        "on-secondary-container": "var(--color-on-secondary-container)",
        tertiary: "var(--color-tertiary)",
        "on-tertiary": "var(--color-on-tertiary)",
        "tertiary-container": "var(--color-tertiary-container)",
        "on-tertiary-container": "var(--color-on-tertiary-container)",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        "primary-fixed": "#ffdbcc",
        "primary-fixed-dim": "#ffb693",
        "on-primary-fixed": "#351000",
        "on-primary-fixed-variant": "#7a3000",
        "secondary-fixed": "#9cf5c0",
        "secondary-fixed-dim": "#80d8a5",
        "on-secondary-fixed": "#002111",
        "on-secondary-fixed-variant": "#005231",
        "tertiary-fixed": "#d0e4ff",
        "tertiary-fixed-dim": "#9ccaff",
        "on-tertiary-fixed": "#001d35",
        "on-tertiary-fixed-variant": "#00497b",
        background: "var(--color-background)",
        "on-background": "var(--color-on-background)",
        "surface-variant": "var(--color-surface-variant)",
        "map-background": "#0B0B0C",
        "map-surface": "#161618",
        "map-on-surface": "#E5E2E3",
        "map-outline": "#28282A",
        "map-chili": "#FF3B30",
        "map-mango": "#FFB020",
        "map-lime": "#C8F542",
        "map-glow": "#FFB4AA",
        "sheet-background": "var(--color-sheet-background)",
        "sheet-surface": "var(--color-sheet-surface)",
        "sheet-surface-low": "var(--color-sheet-surface-low)",
        "sheet-on-surface": "var(--color-sheet-on-surface)",
        "sheet-on-surface-muted": "var(--color-sheet-on-surface-muted)",
        "sheet-outline": "var(--color-sheet-outline)",
        "tertiary-dark": "var(--color-tertiary-dark)",
      },
      fontFamily: {
        "display-map": ["var(--font-anton)"],
        "map-pin": ["var(--font-dm-sans)"],
        "title-md": ["var(--font-plus-jakarta-sans)"],
        "body-md": ["var(--font-be-vietnam-pro)"],
        "label-caps": ["var(--font-be-vietnam-pro)"],
        "headline-sheet": ["var(--font-plus-jakarta-sans)"],
      },
      fontSize: {
        "display-map": ["48px", { lineHeight: "1.1", fontWeight: "400" }],
        "map-pin": ["11px", { lineHeight: "12px", fontWeight: "500" }],
        "title-md": ["18px", { lineHeight: "24px", fontWeight: "600" }],
        "body-md": ["15px", { lineHeight: "22px", fontWeight: "400" }],
        "label-caps": [
          "11px",
          { lineHeight: "16px", letterSpacing: "0.08em", fontWeight: "600" },
        ],
        "headline-sheet": ["24px", { lineHeight: "32px", fontWeight: "700" }],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
      },
      spacing: {
        unit: "4px",
        gutter: "16px",
        "margin-mobile": "16px",
        "margin-desktop": "32px",
        "sheet-padding": "24px",
      },
    },
  },
};

export default config;
