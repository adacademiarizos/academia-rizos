import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['fluent-ffmpeg', '@ffmpeg-installer/ffmpeg', 'puppeteer', 'puppeteer-core', '@sparticuz/chromium'],
};

export default nextConfig;
