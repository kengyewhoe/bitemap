import type { Metadata } from "next";

export const metadata: Metadata = { title: "Me" };

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
