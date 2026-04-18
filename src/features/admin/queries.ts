import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { cache } from "react";

export interface AdminMetrics {
  activeListings: number;
  draftListings: number;
  suspendedListings: number;
  newUsersThisWeek: number;
  pendingReviews: number;
  unresolvedFlags: number;
  listingsPerCategory: { categoryId: string; nameAr: string; count: number }[];
}

const ADMIN_METRICS_KEY = "admin:metrics";

export const getAdminMetrics = cache(async (): Promise<AdminMetrics> => {
  // Try cache first
  const cached = await redis.get<AdminMetrics>(ADMIN_METRICS_KEY);
  if (cached) {
    return cached;
  }

  // Get counts in parallel
  const [
    activeListings,
    draftListings,
    suspendedListings,
    newUsersThisWeek,
    pendingReviews,
    unresolvedFlags,
    listingsPerCategory,
  ] = await Promise.all([
    prisma.businessProfile.count({
      where: { status: "ACTIVE", deletedAt: null },
    }),
    prisma.businessProfile.count({
      where: { status: "DRAFT", deletedAt: null },
    }),
    prisma.businessProfile.count({
      where: { status: "SUSPENDED", deletedAt: null },
    }),
    prisma.user.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.mediaFile.count({
      where: { status: "PENDING" },
    }),
    prisma.reviewFlag.count({
      where: { status: "PENDING" },
    }),
    prisma.businessProfile.groupBy({
      by: ["categoryId"],
      where: { status: "ACTIVE", deletedAt: null },
      _count: { id: true },
    }),
  ]);

  // Get category names
  const categoryIds = listingsPerCategory.map((c) => c.categoryId);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, nameAr: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c.nameAr]));

  const result: AdminMetrics = {
    activeListings,
    draftListings,
    suspendedListings,
    newUsersThisWeek,
    pendingReviews,
    unresolvedFlags,
    listingsPerCategory: listingsPerCategory.map((c) => ({
      categoryId: c.categoryId,
      nameAr: categoryMap.get(c.categoryId) || "Unknown",
      count: c._count.id,
    })),
  };

  // Cache for 60 seconds
  await redis.set(ADMIN_METRICS_KEY, result, { ex: 60 });

  return result;
});