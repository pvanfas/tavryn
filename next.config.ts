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

  // Optimize image caching on Vercel CDN
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
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
      // Long-term immutable caching for static assets on Vercel CDN
      {
        source: "/:path*.(svg|png|jpg|jpeg|gif|webp|ico|csv)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Edge CDN caching for the public landing page
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
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
