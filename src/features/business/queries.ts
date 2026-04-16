// src/features/business/queries.ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getListingBySlug(slug: string) {
  return prisma.businessProfile.findFirst({
    where: {
      slug,
      status: "ACTIVE",
      deletedAt: null,
    },
    include: {
      category: true,
      city: true,
      subcategory: true,
      phoneNumbers: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      workingHours: {
        orderBy: { dayOfWeek: "asc" },
      },
      socialLinks: {
        orderBy: { createdAt: "asc" },
      },
      mediaFiles: {
        where: {
          status: "APPROVED",
        },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
      owner: {
        select: { id: true, name: true },
      },
    },
  });
}

export async function getListingByIdForOwner(
  listingId: string,
  ownerId: string,
) {
  return prisma.businessProfile.findFirst({
    where: {
      id: listingId,
      ownerId,
      deletedAt: null,
    },
    include: {
      category: true,
      city: true,
      subcategory: true,
      phoneNumbers: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      workingHours: {
        orderBy: { dayOfWeek: "asc" },
      },
      socialLinks: {
        orderBy: { createdAt: "asc" },
      },
      mediaFiles: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function getListingsByOwner(ownerId: string) {
  return prisma.businessProfile.findMany({
    where: {
      ownerId,
      deletedAt: null,
    },
    include: {
      category: true,
      city: true,
      _count: {
        select: {
          phoneNumbers: true,
          mediaFiles: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

type PublicListingFilters = {
  citySlug?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  page?: number;
  limit?: number;
};

export type { PublicListingFilters };

export async function getPublicListings(filters: PublicListingFilters) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;

  const where: Prisma.BusinessProfileWhereInput = {
    status: "ACTIVE",
    deletedAt: null,
    ...(filters.citySlug ? { city: { slug: filters.citySlug } } : {}),
    ...(filters.categorySlug
      ? { category: { slug: filters.categorySlug } }
      : {}),
    ...(filters.subcategorySlug
      ? { subcategory: { slug: filters.subcategorySlug } }
      : {}),
  };

  return prisma.businessProfile.findMany({
    where,
    include: {
      category: true,
      city: true,
      subcategory: true,
      phoneNumbers: {
        take: 1,
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      mediaFiles: {
        where: {
          OR: [{ type: "COVER" }, { type: "PHOTO" }, { type: "IMAGE" }],
          status: "APPROVED",
        },
        take: 1,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [
      { isVerified: "desc" },
      { viewCount: "desc" },
      { publishedAt: "desc" },
    ],
    skip: (page - 1) * limit,
    take: limit,
  });
}

// Search businesses by name or description
// Uses pg_trgm index for fuzzy search
export async function searchListings({
  query,
  citySlug = "al-nabik",
  limit = 20,
}: {
  query: string;
  citySlug?: string;
  limit?: number;
}): Promise<Awaited<ReturnType<typeof getPublicListings>>> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.trim();

  return prisma.businessProfile.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      city: { slug: citySlug },
      OR: [
        { nameAr: { contains: searchTerm, mode: "insensitive" } },
        { nameEn: { contains: searchTerm, mode: "insensitive" } },
        { descriptionAr: { contains: searchTerm, mode: "insensitive" } },
        { descriptionEn: { contains: searchTerm, mode: "insensitive" } },
      ],
    },
    include: {
      category: true,
      city: true,
      subcategory: true,
      phoneNumbers: {
        take: 1,
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      mediaFiles: {
        where: {
          OR: [{ type: "COVER" }, { type: "PHOTO" }, { type: "IMAGE" }],
          status: "APPROVED",
        },
        take: 1,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [{ isVerified: "desc" }, { viewCount: "desc" }],
    take: limit,
  });
}

// Get featured/popular listings for homepage
export async function getFeaturedListings({
  citySlug = "al-nabik",
  limit = 6,
}: {
  citySlug?: string;
  limit?: number;
}) {
  return prisma.businessProfile.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      city: { slug: citySlug },
    },
    include: {
      category: true,
      city: true,
      subcategory: true,
      phoneNumbers: {
        take: 1,
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      mediaFiles: {
        where: {
          OR: [{ type: "COVER" }, { type: "PHOTO" }],
          status: "APPROVED",
        },
        take: 1,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [
      { isVerified: "desc" },
      { viewCount: "desc" },
      { publishedAt: "desc" },
    ],
    take: limit,
  });
}
