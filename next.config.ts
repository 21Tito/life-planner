import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stripe webhook needs raw body
  experimental: {},
  async redirects() {
    return [
      { source: "/dashboard/:path*", destination: "/trips", permanent: false },
    ];
  },
};

export default nextConfig;
