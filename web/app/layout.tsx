import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import {
  Anton,
  Plus_Jakarta_Sans,
  Be_Vietnam_Pro,
  DM_Sans,
} from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./sw-register";

// Self-hosted at build time via next/font — no external font CDN, no
// render-blocking <link> tags. Weights mirror the legacy
// frontend/js/head.html Google Fonts request.
const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// No dedicated production domain is provisioned yet — fall back through the
// env var a deploy can set, then Vercel's own runtime URL, then localhost
// for dev. metadataBase only needs to resolve the openGraph image URL below.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BiteMap",
    template: "%s — BiteMap",
  },
  description:
    "Find and vote on the best street food in KL, from the creators who actually eat there.",
  openGraph: {
    title: "BiteMap",
    description:
      "Find and vote on the best street food in KL, from the creators who actually eat there.",
    images: ["/icon-512.png"],
  },
};

// viewport-fit: cover is what makes env(safe-area-inset-*) resolve to a real
// value instead of 0 on notched/home-indicator iOS devices — Nav.tsx and
// BottomSheet.tsx both rely on that inset. themeColor is media-scoped so the
// browser chrome matches the nocturnal map in dark and the app surface in
// light, instead of staying white regardless of theme.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0C" },
  ],
};

// The CSP nonce set in middleware.ts only matches script tags rendered
// per-request — a statically prerendered page bakes its HTML (and any
// <script> tags) at build time, before a nonce exists, so React never
// hydrates under the nonce'd CSP. Force every route to render dynamically
// so a fresh nonce is always threaded through. See:
// https://nextjs.org/docs/app/guides/content-security-policy#dynamic-rendering-requirement
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading headers() is what makes Next.js parse the per-request CSP
  // header (set in middleware.ts) and auto-apply its nonce to the
  // framework's own script tags. It also lets us read the nonce ourselves,
  // below, for the anti-FOUC theme-init script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      // The anti-FOUC script below sets data-theme on the client before
      // React hydrates, which never matches the server-rendered markup
      // (data-theme absent). That mismatch is expected and harmless — this
      // silences the warning instead of trying to make the server guess a
      // client-only localStorage value.
      suppressHydrationWarning
      className={`${anton.variable} ${plusJakartaSans.variable} ${beVietnamPro.variable} ${dmSans.variable} h-full antialiased`}
    >
      <head>
        {/* Anti-FOUC: set data-theme before first paint from the saved
            preference, so a saved "dark" choice never flashes light first.
            "system"/absent leaves data-theme unset so the
            prefers-color-scheme media query in globals.css decides. Must
            carry the CSP nonce (middleware.ts) or it's blocked. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("bitemap.theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-on-surface">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
