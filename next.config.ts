import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Explicitly fail production builds on Vercel/CI if any type errors exist
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
