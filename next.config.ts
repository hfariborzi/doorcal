import type { NextConfig } from "next";

// Pages with account or booking actions must not be framed by other sites (clickjacking).
// Public booking pages are left frameable so they can be embedded later.
const noFraming = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The official instance moved from doorcal.com to midore.app on 2026-10-11. Calendar webhooks stay on the old host
  // because Google and Microsoft don't follow redirects; their channels move to midore.app as the daily cron renews them.
  async redirects() {
    return [
      {
        source: "/:path((?!api/calendar/webhook/).*)",
        has: [{ type: "host", value: "(www\\.)?doorcal\\.com" }],
        destination: "https://midore.app/:path",
        permanent: true,
      },
    ];
  },
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
