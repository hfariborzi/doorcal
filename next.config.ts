import type { NextConfig } from "next";

// Pages with account or booking actions must not be framed by other sites (clickjacking).
// Public booking pages are left frameable so they can be embedded later.
const noFraming = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/dashboard/:path*", headers: noFraming },
      { source: "/dashboard", headers: noFraming },
      { source: "/login", headers: noFraming },
      { source: "/booking/:path*", headers: noFraming },
    ];
  },
};

export default nextConfig;
