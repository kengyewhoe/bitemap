import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "BiteMap",
  description: "BiteMap",
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
