import { Metadata } from "next";
import { getAllCategories } from "@/features/categories/queries";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "دليل المدن - دليل النبك",
    description: "دليل شامل للمؤسسات التجارية والخدمات في مدينة النبك",
    alternates: {
      languages: {
        ar: "https://city-directory.com/ar",
        en: "https://city-directory.com/en",
      },
    },
  };
}

export default async function Sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://city-directory.com";

  // Get all active categories
  const categories = await getAllCategories();

  // Get all active listings
  const listings = await prisma.businessProfile.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      slug: true,
      category: {
        select: { slug: true },
      },
      updatedAt: true,
    },
    take: 1000,
  });

  // Build static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/ar`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/en`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    },
  ];

  // Build category pages
  const categoryPages = categories.map((category) => ({
    url: `${baseUrl}/ar/al-nabik/${category.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Build listing pages
  const listingPages = listings.map((listing) => ({
    url: `${baseUrl}/ar/al-nabik/${listing.category.slug}/${listing.slug}`,
    lastModified: listing.updatedAt || new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const allPages = [...staticPages, ...categoryPages, ...listingPages];

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.lastModified.toISOString()}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`,
    {
      headers: {
        "Content-Type": "application/xml",
      },
    }
  );
}