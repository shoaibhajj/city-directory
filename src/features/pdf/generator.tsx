"use server";

import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { DirectoryDocument } from "./templates/DirectoryDocument";

interface GeneratePdfOptions {
  citySlug: string;
  categorySlug: string;
  _locale?: string; // Reserved for future bilingual PDF support
}

export async function generateDirectoryPdf({
  citySlug,
  categorySlug,
}: GeneratePdfOptions): Promise<Buffer> {
  // Check cache first
  // Note: For full PDF streaming, we'd cache the URL, but for now generate on demand
  // In production, upload to Cloudinary/S3 and cache the URL

  // Fetch listings
  const listings = await prisma.businessProfile.findMany({
    where: {
      city: { slug: citySlug },
      category: { slug: categorySlug },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      nameAr: true,
      nameEn: true,
      addressAr: true,
      phoneNumbers: {
        select: { number: true },
      },
      city: {
        select: { nameAr: true },
      },
      category: {
        select: { nameAr: true },
      },
      verifiedAt: true,
    },
    orderBy: { nameAr: "asc" },
  });

  // Get city and category names
  const city = await prisma.city.findUnique({
    where: { slug: citySlug },
    select: { nameAr: true },
  });

  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
    select: { nameAr: true },
  });

  if (!city || !category) {
    throw new Error("City or category not found");
  }

  // Generate PDF
  const pdfBuffer = await renderToBuffer(
    <DirectoryDocument
      cityName={city.nameAr}
      categoryName={category.nameAr}
      businesses={listings}
      generatedAt={new Date()}
      totalCount={listings.length}
    />
  );

  return pdfBuffer;
}

export async function getOrGeneratePdf(options: GeneratePdfOptions): Promise<Buffer> {
  // Generate fresh PDF (cache implementation reserved for production)
  const pdfBuffer = await generateDirectoryPdf(options);

  return pdfBuffer;
}