"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { writeAuditLog } from "@/lib/audit";
import { getSettingNumber } from "@/features/platform/settings";
import { BUSINESS_CREATE_RATE_LIMIT_SECONDS, WEEK_DAYS } from "./constants";
import {
  CreateListingSchema,
  UpdateBasicInfoSchema,
  UpdateContactSchema,
  UpdateHoursSchema,
  UpdateSocialSchema,
  SearchSchema,
} from "./schemas";
import {
  buildBusinessPath,
  buildJsonDiff,
  buildSearchableText,
  canTransitionTo,
  generateSlug,
} from "./utils";
import {
  actionSuccess,
  actionError,
  type ActionResult,
} from "@/lib/action-response";
import { handleActionError } from "@/lib/handle-error";
import {
  AuthError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  LimitExceededError,
} from "@/lib/errors";
import { ErrorCodes } from "@/lib/error-codes";

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Throws typed errors instead of raw strings.
 * Every caller can now catch AuthError | ForbiddenError specifically,
 * or let handleActionError normalize them at the boundary.
 */
async function requireVerifiedOwnerSession() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AuthError("يجب تسجيل الدخول أولاً");
  }

  if (!session.user.emailVerified) {
    // AUTH_EMAIL_NOT_VERIFIED maps to the correct code from error-codes.ts
    throw new AuthError("يجب التحقق من البريد الإلكتروني أولاً");
  }

  return session;
}

async function validateCategoryAndSubcategory(
  categoryId: string,
  subcategoryId?: string | null,
) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new NotFoundError("التصنيف");
  }

  if (!subcategoryId) return;

  const subcategory = await prisma.subcategory.findFirst({
    where: { id: subcategoryId, categoryId },
    select: { id: true },
  });

  if (!subcategory) {
    // ValidationError not NotFound — the subcategory may exist but not under this category
    throw new ValidationError("التصنيف الفرعي لا ينتمي إلى هذا التصنيف");
  }
}

async function revalidateListingPublicPaths(listing: {
  slug: string;
  city: { slug: string };
  category: { slug: string };
}) {
  for (const locale of ["ar", "en"]) {
    revalidatePath(
      buildBusinessPath({
        locale,
        citySlug: listing.city.slug,
        categorySlug: listing.category.slug,
        businessSlug: listing.slug,
      }),
    );
    revalidatePath(`/${locale}/${listing.city.slug}/${listing.category.slug}`);
  }
}

async function invalidatePdfCache(citySlug: string, categorySlug: string) {
  await redis.del(`pdf:${citySlug}:${categorySlug}`);
  await redis.del(`pdf:${citySlug}:all`);
}

// ─── createListingAction ──────────────────────────────────────────────────────

export async function createListingAction(
  rawData: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const session = await requireVerifiedOwnerSession();
    const userId = session.user.id;

    // ── Owner limit ──
    const maxListings = await getSettingNumber("max_listings_per_owner", 3);
    const currentCount = await prisma.businessProfile.count({
      where: { ownerId: userId, deletedAt: null },
    });

    if (currentCount >= maxListings) {
      throw new LimitExceededError(
        `وصلت للحد الأقصى من القوائم (${maxListings})`,
        ErrorCodes.LISTING_LIMIT_REACHED,
      );
    }

    // ── Rate limit ──
    const rateLimitKey = `listing_create:${userId}`;
    const alreadyCreated = await redis.get(rateLimitKey);

    if (alreadyCreated) {
      throw new RateLimitError("يمكنك إنشاء قائمة واحدة فقط كل 24 ساعة");
    }

    // ── Validation ──
    const parsed = CreateListingSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "بيانات غير صحيحة",
      );
    }
    const data = parsed.data;

    // ── Category / City checks ──
    await validateCategoryAndSubcategory(data.categoryId, data.subcategoryId);

    const city = await prisma.city.findUnique({
      where: { id: data.cityId },
      select: { id: true },
    });
    if (!city) throw new NotFoundError("المدينة");

    // ── DB write ──
    const created = await prisma.$transaction(async (tx) => {
      const finalSlug = await generateSlug(data.nameAr);

      const draft = await tx.businessProfile.create({
        data: {
          ownerId: userId,
          nameAr: data.nameAr,
          nameEn: data.nameEn || null,
          slug: finalSlug,
          descriptionAr: data.descriptionAr || null,
          descriptionEn: data.descriptionEn || null,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId || null,
          cityId: data.cityId,
          status: "DRAFT",
          searchableText: buildSearchableText({
            nameAr: data.nameAr,
            nameEn: data.nameEn || null,
            descriptionAr: data.descriptionAr || null,
            addressAr: null,
          }),
        },
        include: { city: true, category: true },
      });

      await tx.workingHours.createMany({
        data: WEEK_DAYS.map((dayOfWeek) => ({
          businessId: draft.id,
          dayOfWeek,
          isClosed: true,
          openTime: null,
          closeTime: null,
        })),
      });

      return draft;
    });

    await redis.setex(rateLimitKey, BUSINESS_CREATE_RATE_LIMIT_SECONDS, "1");

    writeAuditLog({
      actorId: userId,
      actorEmail: session.user.email ?? null,
      actorRole: session.user.role,
      action: "LISTING_CREATED",
      entityType: "BusinessProfile",
      entityId: created.id,
      newValues: { id: created.id, slug: created.slug, status: created.status },
    });

    return actionSuccess({ id: created.id, slug: created.slug });
  } catch (err) {
    return actionError(
      handleActionError(err),
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
}

// ─── updateListingAction ──────────────────────────────────────────────────────

export async function updateListingAction(
  listingId: string,
  step: "basic" | "contact" | "hours" | "social",
  rawData: unknown,
): Promise<ActionResult<{ slug?: string }>> {
  try {
    const session = await requireVerifiedOwnerSession();

    const existing = await prisma.businessProfile.findFirst({
      where: { id: listingId, ownerId: session.user.id, deletedAt: null },
      include: {
        category: true,
        city: true,
        phoneNumbers: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        workingHours: { orderBy: { dayOfWeek: "asc" } },
        socialLinks: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!existing) throw new NotFoundError("القائمة");

    // ── basic ────────────────────────────────────────────────────────────────
    if (step === "basic") {
      const data = UpdateBasicInfoSchema.parse(rawData);

      await validateCategoryAndSubcategory(data.categoryId, data.subcategoryId);

      const nextSlug =
        data.nameAr !== existing.nameAr
          ? await generateSlug(data.nameAr, existing.id)
          : existing.slug;

      const updated = await prisma.businessProfile.update({
        where: { id: existing.id },
        data: {
          nameAr: data.nameAr,
          nameEn: data.nameEn || null,
          descriptionAr: data.descriptionAr || null,
          descriptionEn: data.descriptionEn || null,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId || null,
          cityId: data.cityId,
          slug: nextSlug,
          searchableText: buildSearchableText({
            nameAr: data.nameAr,
            nameEn: data.nameEn || null,
            descriptionAr: data.descriptionAr || null,
            addressAr: existing.addressAr,
          }),
        },
        include: { city: true, category: true },
      });

      const diff = buildJsonDiff(
        {
          nameAr: existing.nameAr,
          nameEn: existing.nameEn,
          descriptionAr: existing.descriptionAr,
          descriptionEn: existing.descriptionEn,
          categoryId: existing.categoryId,
          subcategoryId: existing.subcategoryId,
          cityId: existing.cityId,
          slug: existing.slug,
        },
        {
          nameAr: updated.nameAr,
          nameEn: updated.nameEn,
          descriptionAr: updated.descriptionAr,
          descriptionEn: updated.descriptionEn,
          categoryId: updated.categoryId,
          subcategoryId: updated.subcategoryId,
          cityId: updated.cityId,
          slug: updated.slug,
        },
      );

      writeAuditLog({
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        actorRole: session.user.role,
        action: "LISTING_UPDATED",
        entityType: "BusinessProfile",
        entityId: existing.id,
        previousValues: diff,
        newValues: diff,
      });

      await revalidateListingPublicPaths(updated);

      return actionSuccess({ slug: updated.slug });
    }

    // ── contact ──────────────────────────────────────────────────────────────
    if (step === "contact") {
      const data = UpdateContactSchema.parse(rawData);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.businessProfile.update({
          where: { id: existing.id },
          data: {
            addressAr: data.addressAr || null,
            addressEn: data.addressEn || null,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            searchableText: buildSearchableText({
              nameAr: existing.nameAr,
              nameEn: existing.nameEn,
              descriptionAr: existing.descriptionAr,
              addressAr: data.addressAr || null,
            }),
          },
        });

        await tx.phoneNumber.deleteMany({ where: { businessId: existing.id } });

        await tx.phoneNumber.createMany({
          data: data.phones.map((phone, index) => ({
            businessId: existing.id,
            label: phone.label,
            number: phone.number,
            isPrimary: phone.isPrimary || index === 0,
          })),
        });

        return tx.businessProfile.findUniqueOrThrow({
          where: { id: existing.id },
          include: {
            city: true,
            category: true,
            phoneNumbers: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            },
          },
        });
      });

      const diff = buildJsonDiff(
        {
          addressAr: existing.addressAr,
          addressEn: existing.addressEn,
          latitude: existing.latitude,
          longitude: existing.longitude,
          phones: existing.phoneNumbers.map((p) => ({
            label: p.label,
            number: p.number,
            isPrimary: p.isPrimary,
          })),
        },
        {
          addressAr: updated.addressAr,
          addressEn: updated.addressEn,
          latitude: updated.latitude,
          longitude: updated.longitude,
          phones: updated.phoneNumbers.map((p) => ({
            label: p.label,
            number: p.number,
            isPrimary: p.isPrimary,
          })),
        },
      );

      writeAuditLog({
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        actorRole: session.user.role,
        action: "LISTING_UPDATED",
        entityType: "BusinessProfile",
        entityId: existing.id,
        previousValues: diff,
        newValues: diff,
      });

      await revalidateListingPublicPaths(updated);

      return actionSuccess({});
    }

    // ── hours ────────────────────────────────────────────────────────────────
    if (step === "hours") {
      const data = UpdateHoursSchema.parse(rawData);

      await prisma.$transaction(async (tx) => {
        await tx.workingHours.deleteMany({
          where: { businessId: existing.id },
        });

        await tx.workingHours.createMany({
          data: data.hours.map((hour) => ({
            businessId: existing.id,
            dayOfWeek: hour.dayOfWeek,
            isClosed: hour.isClosed,
            openTime: hour.isClosed ? null : hour.openTime,
            closeTime: hour.isClosed ? null : hour.closeTime,
          })),
        });
      });

      writeAuditLog({
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        actorRole: session.user.role,
        action: "LISTING_UPDATED",
        entityType: "BusinessProfile",
        entityId: existing.id,
        newValues: { hours: data.hours },
      });

      const refreshed = await prisma.businessProfile.findUniqueOrThrow({
        where: { id: existing.id },
        include: { city: true, category: true },
      });

      await revalidateListingPublicPaths(refreshed);

      return actionSuccess({});
    }

    // ── social ───────────────────────────────────────────────────────────────
    if (step === "social") {
      const data = UpdateSocialSchema.parse(rawData);

      await prisma.$transaction(async (tx) => {
        await tx.socialLink.deleteMany({ where: { businessId: existing.id } });

        await tx.socialLink.createMany({
          data: data.socialLinks.map((social) => ({
            businessId: existing.id,
            platform: social.platform,
            url: social.url,
          })),
        });
      });

      writeAuditLog({
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        actorRole: session.user.role,
        action: "LISTING_UPDATED",
        entityType: "BusinessProfile",
        entityId: existing.id,
        newValues: { socialLinks: data.socialLinks },
      });

      const refreshed = await prisma.businessProfile.findUniqueOrThrow({
        where: { id: existing.id },
        include: { city: true, category: true },
      });

      await revalidateListingPublicPaths(refreshed);

      return actionSuccess({});
    }

    // Unreachable if TypeScript types are correct, but guards against future drift
    throw new ValidationError(`خطوة التحديث غير صالحة: ${step}`);
  } catch (err) {
    return actionError(
      handleActionError(err),
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
}

// ─── submitListingAction ──────────────────────────────────────────────────────

export async function submitListingAction(
  listingId: string,
): Promise<ActionResult<{ status: string }>> {
  try {
    const session = await requireVerifiedOwnerSession();

    const listing = await prisma.businessProfile.findFirst({
      where: { id: listingId, ownerId: session.user.id, deletedAt: null },
      include: { city: true, category: true, phoneNumbers: true },
    });

    if (!listing) throw new NotFoundError("القائمة");

    if (!canTransitionTo(listing.status, "ACTIVE")) {
      throw new ValidationError(
        `لا يمكن نشر القائمة من حالة "${listing.status}"`,
        undefined,
      );
    }

    if (!listing.nameAr || !listing.categoryId || !listing.cityId) {
      throw new ValidationError(
        "الحقول المطلوبة مفقودة: الاسم، التصنيف، المدينة",
      );
    }

    if (listing.phoneNumbers.length === 0) {
      throw new ValidationError("يجب إضافة رقم هاتف واحد على الأقل");
    }

    const updated = await prisma.businessProfile.update({
      where: { id: listing.id },
      data: {
        status: "ACTIVE",
        publishedAt: listing.publishedAt ?? new Date(),
      },
      include: { city: true, category: true },
    });

    writeAuditLog({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      actorRole: session.user.role,
      action: "LISTING_SUBMITTED",
      entityType: "BusinessProfile",
      entityId: updated.id,
      previousValues: { status: listing.status },
      newValues: { status: updated.status, publishedAt: updated.publishedAt },
    });

    await revalidateListingPublicPaths(updated);

    return actionSuccess({ status: updated.status });
  } catch (err) {
    return actionError(
      handleActionError(err),
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
}

// ─── softDeleteListingAction ──────────────────────────────────────────────────

export async function softDeleteListingAction(
  listingId: string,
): Promise<ActionResult> {
  try {
    const session = await auth();

    if (!session?.user?.id) throw new AuthError();

    const isAdmin = ["ADMIN", "SUPERADMIN"].includes(session.user.role);

    const listing = await prisma.businessProfile.findFirst({
      where: {
        id: listingId,
        deletedAt: null,
        // Admins can delete any listing; owners can only delete their own
        ...(isAdmin ? {} : { ownerId: session.user.id }),
      },
      include: { city: true, category: true },
    });

    if (!listing) {
      // If a non-admin tries to delete someone else's listing, show NotFound
      // (never expose "this listing exists but belongs to someone else")
      throw new NotFoundError("القائمة");
    }

    const deletedAt = new Date();

    await prisma.businessProfile.update({
      where: { id: listing.id },
      data: { deletedAt, deletedBy: session.user.id },
    });

    writeAuditLog({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      actorRole: session.user.role,
      action: "LISTING_DELETED",
      entityType: "BusinessProfile",
      entityId: listing.id,
      previousValues: { deletedAt: null },
      newValues: {
        deletedAt: deletedAt.toISOString(),
        deletedBy: session.user.id,
      },
    });

    await invalidatePdfCache(listing.city.slug, listing.category.slug);
    await revalidateListingPublicPaths(listing);

    return actionSuccess(undefined);
  } catch (err) {
    return actionError(
      handleActionError(err),
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
}

// ─── searchListingsAction ─────────────────────────────────────────────────
// Public search action - no auth required
export async function searchListingsAction(
  rawData: unknown,
): Promise<ActionResult<{ results: unknown[] }>> {
  try {
    // Validation - search query must be at least 2 characters
    const parsed = SearchSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("يجب أن يكون البحث حرفين على الأقل");
    }
    const { query, citySlug = "al-nabik" } = parsed.data;

    const { searchListings } = await import("./queries");
    const results = await searchListings({ query, citySlug });

    return actionSuccess({ results });
  } catch (err) {
    return actionError(
      handleActionError(err),
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
}
