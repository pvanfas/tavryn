import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress responses with Gzip/Brotli
  compress: true,

  // Remove x-powered-by header for security and payload size
  poweredByHeader: false,

  typescript: {
    // Explicitly fail production builds on Vercel/CI if any type errors exist
    ignoreBuildErrors: false,
  },

  // Tree-shake large barrel imports to reduce client bundle size
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
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
