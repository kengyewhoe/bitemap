import type { Metadata } from "next";

export const metadata: Metadata = { title: "Choose your location" };

export default function LocationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
