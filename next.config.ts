import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Live preview: sandbox proxy hosts ke liye dev origins allow karo
  // (E2B preview: https://<port>-<sandbox>.e2b.app)
  allowedDevOrigins: [
    "*.e2b.app",
    "*.e2b.dev",
    "localhost",
    "127.0.0.1",
  ],
  // Server actions: bara payload (import/backup) allow
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
