import type { NextConfig } from "next";
const config: NextConfig = {
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
