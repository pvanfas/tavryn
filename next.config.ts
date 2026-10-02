import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Explicitly fail production builds on Vercel/CI if any type errors exist
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return [
      {
        source: "/api/negotiate/:contractId/draft",
        destination: "/api/agent/negotiate/:contractId/outreach",
      },
      {
        source: "/api/negotiate/:contractId/reply",
        destination: "/api/agent/negotiate/:contractId/reply",
      },
      {
        source: "/api/negotiate/:contractId/record-savings",
        destination: "/api/agent/negotiate/:contractId/record-savings",
      },
      {
        source: "/api/negotiate/:contractId",
        destination: "/api/agent/negotiate/:contractId",
      },
    ];
  },
};

export default nextConfig;
