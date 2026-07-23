import type { NextConfig } from "next";

const internalApi = process.env.INTERNAL_API_URL ?? "http://localhost:8000";
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const scriptSource = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: ["127.0.0.1", "localhost", "frontend"],
  devIndicators: false,
  output: "standalone",
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/insights/:slug/cite/csl-json",
        destination: "/insight-citations/:slug.csl.json",
        permanent: true,
      },
      {
        source: "/insights/:slug/cite/bibtex",
        destination: "/insight-citations/:slug.bib",
        permanent: true,
      },
      {
        source: "/insights/:slug/cite/ris",
        destination: "/insight-citations/:slug.ris",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${internalApi}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/open-data-daily",
        headers: [
          {
            key: "Link",
            value: `<${siteUrl}/.well-known/linkset.json>; rel="linkset"; type="application/linkset+json"`,
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; ${scriptSource}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://auth.robokassa.ru`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
