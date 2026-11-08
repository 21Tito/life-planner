import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stripe webhook needs raw body
  experimental: {},
  async redirects() {
    return [
      { source: "/dashboard/:path*", destination: "/trips", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        // The OAuth consent screen must never be framed (clickjacking) or cached
        source: "/oauth/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
