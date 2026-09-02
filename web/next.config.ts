import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to web/ — the monorepo root also has a
  // package-lock.json (frontend/), which Next would otherwise infer.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
