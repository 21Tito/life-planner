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
          // Not "no-referrer": that makes browsers send `Origin: null` on the consent form POST,
          // which the decision endpoint's cross-site check rejects
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
