"use client";

// global-error replaces the root layout entirely when it fires (e.g. a
// throw from app/layout.tsx itself), so per
// app/api-reference/file-conventions/error#global-error it must define its
// own <html>/<body> and pull in whatever it needs — nothing from
// app/layout.tsx reaches it. metadata/generateMetadata aren't supported
// here (error boundaries must be Client Components), and this is too
// catastrophic a fallback to depend on the localStorage theme script, so it
// follows the OS color-scheme media query in globals.css rather than a
// saved data-theme preference.
import { useEffect } from "react";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

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

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${beVietnamPro.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col items-center justify-center gap-3 bg-sheet-background px-gutter text-center text-sheet-on-surface">
        <h1 className="font-headline-sheet text-headline-sheet">Something went wrong</h1>
        <p className="max-w-xs font-body-md text-body-md text-sheet-on-surface-muted">
          BiteMap hit an unexpected error. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-container px-6 py-3.5 font-title-md text-title-md text-on-primary shadow-sm active:opacity-90"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
