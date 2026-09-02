import type { Metadata } from "next";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${plusJakartaSans.variable} ${beVietnamPro.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-on-surface">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
