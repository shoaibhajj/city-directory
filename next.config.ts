// next.config.ts
// Location: root of project
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import "./src/env";

// createNextIntlPlugin wraps your Next.js config with i18n support
// The argument is the path to your request.ts file
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    typedRoutes: true,
    middlewarePrefetch: "strict",
  },
};

export default withNextIntl(nextConfig);
