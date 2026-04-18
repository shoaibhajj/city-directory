import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://city-directory.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/_next/",
          "/sign-in",
          "/sign-up",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}