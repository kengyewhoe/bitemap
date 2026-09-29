import { notFound } from "next/navigation";
import { DevComponentsPreview } from "./DevComponentsPreview";

// Internal component-kit visual proof page — dev-only. notFound() only
// works from a Server Component (see node_modules/next/dist/docs), so the
// gate lives here and the interactive preview is a separate client module.
export default function DevComponentsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DevComponentsPreview />;
}
