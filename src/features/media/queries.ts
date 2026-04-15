import { prisma } from "@/lib/prisma";
import { MediaStatus, MediaType } from "@prisma/client";

/** All media for a listing — used in owner dashboard */
export async function getMediaByListing(listingId: string) {
  return prisma.mediaFile.findMany({
    where: { businessId: listingId },
    orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });
}

/** Only APPROVED media — used on the public profile page */
export async function getApprovedMediaByListing(listingId: string) {
  return prisma.mediaFile.findMany({
    where: { businessId: listingId, status: MediaStatus.APPROVED },
    orderBy: [{ type: "asc" }, { displayOrder: "asc" }],
  });
}

/**
 * All confirmed PENDING videos — used in admin moderation queue.
 * cloudinaryPublicId NOT NULL means the upload phase completed;
 * bare DB records (failed uploads) are excluded.
 */
export async function getPendingVideos() {
  return prisma.mediaFile.findMany({
    where: {
      type: MediaType.VIDEO,
      status: MediaStatus.PENDING,
      cloudinaryPublicId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    include: {
      business: {
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          slug: true,
          ownerId: true,
          owner: { select: { id: true, name: true, email: true } },
          city: { select: { slug: true } },
          category: { select: { slug: true } },
        },
      },
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

/**
 * Single media file with its parent listing.
 * Includes city + category slugs for ISR cache invalidation.
 */
export async function getMediaWithListing(mediaFileId: string) {
  return prisma.mediaFile.findUnique({
    where: { id: mediaFileId },
    include: {
      business: {
        select: {
          id: true,
          ownerId: true,
          nameAr: true,
          slug: true,
          coverImageId: true,
          logoImageId: true,
          city: { select: { slug: true } },
          category: { select: { slug: true } },
        },
      },
    },
  });
}

/** Count non-rejected media of a given type — for upload limit enforcement */
export async function countActiveMedia(
  listingId: string,
  type: MediaType,
): Promise<number> {
  return prisma.mediaFile.count({
    where: {
      businessId: listingId,
      type,
      status: { not: MediaStatus.REJECTED },
    },
  });
}
