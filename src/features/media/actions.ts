"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { MediaStatus, MediaType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  generateUploadSignature,
  deleteImageAsset,
  deleteVideoAsset,
  getVideoMetadata,
  uploadBuffer,
  type UploadSignatureResult,
} from "./cloudinary";
import { processImage, generateThumbnail } from "./image-processor";
import { validateImageFile } from "./validators";
import { getSettingNumber } from "@/features/platform/settings";
import { sendNotification } from "@/features/notifications/sender";
import { getMediaWithListing, countActiveMedia } from "./queries";
import { isAdmin, isOwnerOrAdmin } from "@/lib/permissions";
import {
  GeneratePresignedUrlSchema,
  ConfirmUploadSchema,
  DeleteMediaSchema,
  ReorderMediaSchema,
  ApproveMediaSchema,
  RejectMediaSchema,
} from "./schemas";

// ─── Shared result type ───────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds the ISR revalidation path from a media file's business relations */
function buildPublicPath(business: {
  slug: string;
  city: { slug: string } | null;
  category: { slug: string } | null;
}): string {
  const city = business.city?.slug ?? "_";
  const category = business.category?.slug ?? "_";
  return `/ar/${city}/${category}/${business.slug}`;
}

// ─── generatePresignedUrlAction ───────────────────────────────────────────────

export async function generatePresignedUrlAction(
  listingId: string,
  type: string,
): Promise<ActionResult<UploadSignatureResult & { mediaFileId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "غير مصرح" };

  const parsed = GeneratePresignedUrlSchema.safeParse({ listingId, type });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { listingId: lid, type: mediaType } = parsed.data;

  // Ownership check — always in Server Action, never in middleware
  const listing = await prisma.businessProfile.findFirst({
    where: { id: lid, ownerId: session.user.id },
    select: { id: true },
  });
  if (!listing) {
    return {
      success: false,
      error: "المنشأة غير موجودة أو لا تملك صلاحية التعديل",
    };
  }

  // Count-based limits per type
  if (mediaType === MediaType.PHOTO) {
    const max = await getSettingNumber("max_photos_per_listing", 10);
    const count = await countActiveMedia(lid, MediaType.PHOTO);
    if (count >= max) {
      return { success: false, error: `الحد الأقصى للصور هو ${max} صورة` };
    }
  }

  if (mediaType === MediaType.VIDEO) {
    const max = await getSettingNumber("max_videos", 3);
    const count = await countActiveMedia(lid, MediaType.VIDEO);
    if (count >= max) {
      return { success: false, error: `الحد الأقصى للفيديوهات هو ${max}` };
    }
  }

  // COVER and LOGO: new upload will replace the old one AFTER successful
  // processing (in confirmUploadAction) to avoid a window with no cover/logo

  const isVideo = mediaType === MediaType.VIDEO;
  const folder = isVideo
    ? `city-directory/videos/${lid}`
    : `city-directory/images/${lid}/raw`;

  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const publicId = uniqueSuffix;

  // Create the PENDING placeholder — "claims" the slot before Cloudinary upload
  const mediaFile = await prisma.mediaFile.create({
    data: {
      businessId: lid,
      type: mediaType as MediaType,
      status: MediaStatus.PENDING,
      uploadedById: session.user.id,
      displayOrder: 9999,
    },
  });

  const signatureData = generateUploadSignature(folder, publicId);

  return {
    success: true,
    data: { mediaFileId: mediaFile.id, ...signatureData },
  };
}

// ─── confirmUploadAction ──────────────────────────────────────────────────────

type ConfirmResult = {
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  status: MediaStatus;
};

export async function confirmUploadAction(
  mediaFileId: string,
  cloudinaryPublicId: string,
  resourceType: "image" | "video",
): Promise<ActionResult<ConfirmResult>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "غير مصرح" };

  const parsed = ConfirmUploadSchema.safeParse({
    mediaFileId,
    cloudinaryPublicId,
    resourceType,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const mediaFile = await getMediaWithListing(mediaFileId);
  if (!mediaFile) return { success: false, error: "سجل الملف غير موجود" };
  if (mediaFile.business.ownerId !== session.user.id) {
    return { success: false, error: "غير مصرح" };
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;

  // ── IMAGE PIPELINE ──────────────────────────────────────────────────────────

  if (resourceType === "image") {
    const rawUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${cloudinaryPublicId}`;
    let rawBuffer: Buffer;

    try {
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error(`Cloudinary fetch returned ${res.status}`);
      rawBuffer = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      await cleanup(mediaFileId, cloudinaryPublicId, "image");
      console.error("[confirmUpload] Fetch from Cloudinary failed:", err);
      return { success: false, error: "فشل في جلب الصورة من Cloudinary" };
    }

    // ── MAGIC BYTES SECURITY CHECK ──────────────────────────────────────────
    // This is the server-side gate that catches renamed .exe files
    const validation = validateImageFile(rawBuffer);
    if (!validation.valid) {
      await cleanup(mediaFileId, cloudinaryPublicId, "image");
      return {
        success: false,
        error: validation.error ?? "نوع الملف غير مسموح به",
      };
    }

    // ── SHARP PIPELINE ───────────────────────────────────────────────────────
    let processed: Awaited<ReturnType<typeof processImage>>;
    let thumbBuffer: Buffer | undefined;

    try {
      [processed, thumbBuffer] = await Promise.all([
        processImage(rawBuffer),
        generateThumbnail(rawBuffer),
      ]);
    } catch (err) {
      await cleanup(mediaFileId, cloudinaryPublicId, "image");
      console.error("[confirmUpload] Sharp processing failed:", err);
      return { success: false, error: "فشل في معالجة الصورة" };
    }

    // ── RE-UPLOAD PROCESSED IMAGE TO CLOUDINARY ──────────────────────────────
    const bid = mediaFile.businessId;
    const processedFolder = `city-directory/images/${bid}/processed`;
    const thumbFolder = `city-directory/images/${bid}/thumbnails`;

    let uploadResult: Awaited<ReturnType<typeof uploadBuffer>>;
    let thumbnailUrl: string | undefined;

    try {
      uploadResult = await uploadBuffer(processed.buffer, {
        folder: processedFolder,
        publicId: `${mediaFileId}-processed`,
        format: "webp",
      });
    } catch (err) {
      await cleanup(mediaFileId, cloudinaryPublicId, "image");
      console.error("[confirmUpload] Processed re-upload failed:", err);
      return { success: false, error: "فشل في رفع الصورة المعالجة" };
    }

    if (thumbBuffer) {
      try {
        const thumbResult = await uploadBuffer(thumbBuffer, {
          folder: thumbFolder,
          publicId: `${mediaFileId}-thumb`,
          format: "webp",
        });
        thumbnailUrl = thumbResult.secureUrl;
      } catch {
        // Thumbnail is non-critical — log and continue
        console.warn("[confirmUpload] Thumbnail upload failed (non-fatal)");
      }
    }

    // Delete the raw upload — replaced by the processed version
    deleteImageAsset(cloudinaryPublicId).catch((err) =>
      console.warn(
        "[confirmUpload] Could not delete raw upload (non-fatal):",
        err,
      ),
    );

    // ── DEACTIVATE PREVIOUS COVER/LOGO ────────────────────────────────────────
    if (
      mediaFile.type === MediaType.COVER ||
      mediaFile.type === MediaType.LOGO
    ) {
      await prisma.mediaFile.updateMany({
        where: {
          businessId: mediaFile.businessId,
          type: mediaFile.type,
          id: { not: mediaFileId },
          status: MediaStatus.APPROVED,
        },
        data: {
          status: MediaStatus.REJECTED,
          rejectionReason: "تم استبداله بنسخة جديدة",
        },
      });
    }

    // ── UPDATE DB RECORD ──────────────────────────────────────────────────────
    const processedPublicId = `${processedFolder}/${mediaFileId}-processed`;

    await prisma.mediaFile.update({
      where: { id: mediaFileId },
      data: {
        cloudinaryPublicId: processedPublicId,
        url: uploadResult.secureUrl,
        thumbnailUrl,
        width: processed.width,
        height: processed.height,
        sizeBytes: processed.sizeBytes,
        mimeType: "image/webp",
        status: MediaStatus.APPROVED,
        approvedAt: new Date(),
      },
    });

    // ── UPDATE BUSINESS PROFILE COVER/LOGO REFERENCES ────────────────────────
    if (mediaFile.type === MediaType.COVER) {
      await prisma.businessProfile.update({
        where: { id: mediaFile.businessId },
        data: {
          coverImageId: mediaFileId,
          coverImageUrl: uploadResult.secureUrl,
        },
      });
    } else if (mediaFile.type === MediaType.LOGO) {
      await prisma.businessProfile.update({
        where: { id: mediaFile.businessId },
        data: {
          logoImageId: mediaFileId,
          logoImageUrl: uploadResult.secureUrl,
        },
      });
    }

    revalidatePath(buildPublicPath(mediaFile.business));

    await writeAuditLog({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      actorRole: session.user.role as Role,
      action: "MEDIA_UPLOADED",
      entityType: "MediaFile",
      entityId: mediaFileId,
      newValues: {
        type: mediaFile.type,
        url: uploadResult.secureUrl,
        mimeType: "image/webp",
      },
    });

    return {
      success: true,
      data: {
        url: uploadResult.secureUrl,
        thumbnailUrl,
        width: processed.width,
        height: processed.height,
        status: MediaStatus.APPROVED,
      },
    };
  }

  // ── VIDEO PIPELINE ──────────────────────────────────────────────────────────

  const metadata = await getVideoMetadata(cloudinaryPublicId);
  if (!metadata) {
    await cleanup(mediaFileId, cloudinaryPublicId, "video");
    return {
      success: false,
      error: "لم يتم العثور على بيانات الفيديو في Cloudinary",
    };
  }

  const maxDuration = await getSettingNumber("max_video_duration_seconds", 300);
  if (metadata.duration > maxDuration) {
    await cleanup(mediaFileId, cloudinaryPublicId, "video");
    return {
      success: false,
      error: `مدة الفيديو (${Math.round(metadata.duration)}s) تتجاوز الحد المسموح (${maxDuration}s)`,
    };
  }

  const videoUrl = `https://res.cloudinary.com/${cloudName}/video/upload/${cloudinaryPublicId}`;
  const thumbnailUrl = `https://res.cloudinary.com/${cloudName}/video/upload/so_0,w_400,h_300,c_fill,f_jpg/${cloudinaryPublicId}.jpg`;

  // durationSeconds is Int? — Math.round to satisfy the schema
  await prisma.mediaFile.update({
    where: { id: mediaFileId },
    data: {
      cloudinaryPublicId,
      url: videoUrl,
      thumbnailUrl,
      width: metadata.width,
      height: metadata.height,
      durationSeconds: Math.round(metadata.duration),
      mimeType: "video/mp4",
      status: MediaStatus.PENDING, // stays PENDING until admin approves
    },
  });

  // Notify all admins — fire-and-forget
  const admins = await prisma.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
    select: { id: true },
  });
  admins.forEach((admin) =>
    sendNotification(admin.id, "VIDEO_PENDING_REVIEW", {
      listingId: mediaFile.businessId,
      listingName: mediaFile.business.nameAr,
      mediaFileId,
    }),
  );

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role as Role,
    action: "MEDIA_UPLOADED",
    entityType: "MediaFile",
    entityId: mediaFileId,
    newValues: {
      type: "VIDEO",
      duration: Math.round(metadata.duration),
      status: "PENDING",
    },
  });

  return {
    success: true,
    data: {
      url: videoUrl,
      thumbnailUrl,
      status: MediaStatus.PENDING,
    },
  };
}

// ─── Cleanup helper (delete Cloudinary asset + DB record on failure) ──────────

async function cleanup(
  mediaFileId: string,
  cloudinaryPublicId: string,
  resourceType: "image" | "video",
): Promise<void> {
  const delFn = resourceType === "video" ? deleteVideoAsset : deleteImageAsset;
  await Promise.allSettled([
    delFn(cloudinaryPublicId),
    prisma.mediaFile.delete({ where: { id: mediaFileId } }),
  ]);
}

// ─── deleteMediaAction ────────────────────────────────────────────────────────

export async function deleteMediaAction(
  mediaFileId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "غير مصرح" };

  const parsed = DeleteMediaSchema.safeParse({ mediaFileId });
  if (!parsed.success) return { success: false, error: "معرّف الملف غير صحيح" };

  const mediaFile = await getMediaWithListing(mediaFileId);
  if (!mediaFile) return { success: false, error: "الملف غير موجود" };

  if (
    !isOwnerOrAdmin(
      mediaFile.business.ownerId,
      session.user.id,
      session.user.role,
    )
  ) {
    return { success: false, error: "غير مصرح" };
  }

  // Delete from Cloudinary first — failure is non-fatal (orphan cleanup can run later)
  if (mediaFile.cloudinaryPublicId) {
    const delFn =
      mediaFile.type === MediaType.VIDEO ? deleteVideoAsset : deleteImageAsset;
    await delFn(mediaFile.cloudinaryPublicId).catch((err) =>
      console.error(
        "[deleteMedia] Cloudinary delete failed (continuing):",
        err,
      ),
    );
  }

  // Clear cover/logo reference on BusinessProfile if this was the active one
  type ProfilePatch = {
    coverImageId?: null;
    coverImageUrl?: null;
    logoImageId?: null;
    logoImageUrl?: null;
  };
  const profilePatch: ProfilePatch = {};

  if (
    mediaFile.type === MediaType.COVER &&
    mediaFile.business.coverImageId === mediaFileId
  ) {
    profilePatch.coverImageId = null;
    profilePatch.coverImageUrl = null;
  }
  if (
    mediaFile.type === MediaType.LOGO &&
    mediaFile.business.logoImageId === mediaFileId
  ) {
    profilePatch.logoImageId = null;
    profilePatch.logoImageUrl = null;
  }

  await Promise.all([
    Object.keys(profilePatch).length > 0
      ? prisma.businessProfile.update({
          where: { id: mediaFile.businessId },
          data: profilePatch,
        })
      : Promise.resolve(),
    prisma.mediaFile.delete({ where: { id: mediaFileId } }),
  ]);

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role as Role,
    action: "MEDIA_DELETED",
    entityType: "MediaFile",
    entityId: mediaFileId,
    previousValues: {
      type: mediaFile.type,
      url: mediaFile.url,
      status: mediaFile.status,
    },
  });

  revalidatePath(buildPublicPath(mediaFile.business));
  return { success: true, data: undefined };
}

// ─── reorderMediaAction ───────────────────────────────────────────────────────

export async function reorderMediaAction(
  listingId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "غير مصرح" };

  const parsed = ReorderMediaSchema.safeParse({ listingId, orderedIds });
  if (!parsed.success) return { success: false, error: "بيانات غير صحيحة" };

  const listing = await prisma.businessProfile.findFirst({
    where: { id: listingId, ownerId: session.user.id },
    select: { id: true, slug: true },
  });
  if (!listing) {
    return {
      success: false,
      error: "المنشأة غير موجودة أو لا تملك صلاحية التعديل",
    };
  }

  // Bulk update in a single transaction — only updates files owned by this listing
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.mediaFile.update({
        where: {
          id,
          businessId: listingId, // safety: prevents reordering another listing's files
        },
        data: { displayOrder: index },
      }),
    ),
  );

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role as Role,
    action: "MEDIA_REORDERED",
    entityType: "BusinessProfile",
    entityId: listingId,
    newValues: { orderedIds },
  });

  return { success: true, data: undefined };
}

// ─── approveMediaAction ───────────────────────────────────────────────────────

export async function approveMediaAction(
  mediaFileId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "غير مصرح" };

  if (!isAdmin(session.user.role)) {
    return { success: false, error: "يلزم دور المشرف" };
  }

  const parsed = ApproveMediaSchema.safeParse({ mediaFileId });
  if (!parsed.success) return { success: false, error: "معرّف الملف غير صحيح" };

  const mediaFile = await getMediaWithListing(mediaFileId);
  if (!mediaFile) return { success: false, error: "الملف غير موجود" };
  if (mediaFile.type !== MediaType.VIDEO) {
    return { success: false, error: "هذا الإجراء مخصص للفيديوهات فقط" };
  }
  if (mediaFile.status !== MediaStatus.PENDING) {
    return { success: false, error: "هذا الفيديو ليس في حالة انتظار" };
  }

  await prisma.mediaFile.update({
    where: { id: mediaFileId },
    data: {
      status: MediaStatus.APPROVED,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      approvedAt: new Date(),
    },
  });

  // Notify listing owner — fire-and-forget
  sendNotification(mediaFile.business.ownerId, "VIDEO_APPROVED", {
    listingName: mediaFile.business.nameAr,
    listingId: mediaFile.businessId,
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role as Role,
    action: "MEDIA_APPROVED",
    entityType: "MediaFile",
    entityId: mediaFileId,
    newValues: { status: "APPROVED", reviewedById: session.user.id },
  });

  revalidatePath("/ar/admin/media");
  revalidatePath(buildPublicPath(mediaFile.business));

  return { success: true, data: undefined };
}

// ─── rejectMediaAction ────────────────────────────────────────────────────────

export async function rejectMediaAction(
  mediaFileId: string,
  reason: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "غير مصرح" };

  if (!isAdmin(session.user.role)) {
    return { success: false, error: "يلزم دور المشرف" };
  }

  const parsed = RejectMediaSchema.safeParse({ mediaFileId, reason });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const mediaFile = await getMediaWithListing(mediaFileId);
  if (!mediaFile) return { success: false, error: "الملف غير موجود" };
  if (mediaFile.type !== MediaType.VIDEO) {
    return { success: false, error: "هذا الإجراء مخصص للفيديوهات فقط" };
  }

  // Delete from Cloudinary — rejected videos have no reason to persist on CDN
  if (mediaFile.cloudinaryPublicId) {
    await deleteVideoAsset(mediaFile.cloudinaryPublicId).catch((err) =>
      console.error("[rejectMedia] Cloudinary delete failed:", err),
    );
  }

  await prisma.mediaFile.update({
    where: { id: mediaFileId },
    data: {
      status: MediaStatus.REJECTED,
      rejectionReason: reason,
      cloudinaryPublicId: null, // cleared — file no longer exists on Cloudinary
      url: null,
      thumbnailUrl: null,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });

  // Notify listing owner with reason — fire-and-forget
  sendNotification(mediaFile.business.ownerId, "VIDEO_REJECTED", {
    listingName: mediaFile.business.nameAr,
    listingId: mediaFile.businessId,
    reason,
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role as Role,
    action: "MEDIA_REJECTED",
    entityType: "MediaFile",
    entityId: mediaFileId,
    newValues: { status: "REJECTED", reason },
  });

  revalidatePath("/ar/admin/media");

  return { success: true, data: undefined };
}
