import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You're offline — BiteMap",
};

// Offline fallback: precached by the service worker (sw.js) and served for
// navigations that fail while offline. Kept dependency-free and inline-styled
// so it never depends on a stylesheet fetch that could itself be uncached.
export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2rem",
        textAlign: "center",
        backgroundColor: "#0B0B0C",
        color: "#E5E2E3",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "#FFB020",
        }}
      />
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
        You&apos;re offline
      </h1>
      <p style={{ fontSize: "0.9rem", color: "#8e7164", maxWidth: 320 }}>
        BiteMap can&apos;t reach the network right now. Check your connection
        and try again — cached map areas you&apos;ve already visited may still
        work.
      </p>
    </main>
  );
}
