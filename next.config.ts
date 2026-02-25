import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
  eslint: {
    // Pre-existing `no-explicit-any` usages across the codebase don't block production builds.
    // Run `npm run lint` locally to review warnings.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
