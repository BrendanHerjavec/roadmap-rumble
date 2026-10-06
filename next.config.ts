import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, Turbopack walks up to the home directory looking for a
  // lockfile and warns about it.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  // The floating "N" badge lands in every screen recording.
  devIndicators: false,
};

export default nextConfig;
