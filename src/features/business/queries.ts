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
      phoneNumbers: {
        take: 1,
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      mediaFiles: {
        where: {
          type: "IMAGE",
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

export async function searchListings() {
  throw new Error("searchListings will be implemented in Phase 6");
}
