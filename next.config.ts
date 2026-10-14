import type { NextConfig } from "next";
const config: NextConfig = {
  turbopack: { root: process.env.GRANTSNOW_SOURCE_ROOT || process.cwd() },
  // Fixture journeys must not replace the live development server's output.
  distDir:
    process.env.GRANTSNOW_E2E === "true"
      ? ".next-e2e"
      : process.env.GRANTSNOW_BUILD_CHECK === "true"
        ? ".next-check"
        : ".next",
  output: "standalone",
  outputFileTracingExcludes: { "*": ["./.dev-session/**/*"] },
  poweredByHeader: false,
  serverExternalPackages: ["openid-client", "iron-session"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};
export default config;
