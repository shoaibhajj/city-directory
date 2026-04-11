// src/features/business/actions.ts
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

async function requireVerifiedOwnerSession() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  if (!session.user.emailVerified) {
    throw new Error("Email verification required");
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
    throw new Error("Category not found");
  }

  if (!subcategoryId) return;

  const subcategory = await prisma.subcategory.findFirst({
    where: {
      id: subcategoryId,
      categoryId,
    },
    select: { id: true },
  });

  if (!subcategory) {
    throw new Error("Invalid subcategory for this category");
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

export async function createListingAction(
  rawData: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  // ── Auth ──
  let session;
  try {
    session = await requireVerifiedOwnerSession();
  } catch {
    return actionError("يجب تسجيل الدخول أولاً", "UNAUTHORIZED");
  }

  const userId = session.user.id;

  // ── Owner limit ──
  const maxListings = await getSettingNumber("max_listings_per_owner", 3);
  const currentCount = await prisma.businessProfile.count({
    where: { ownerId: userId, deletedAt: null },
  });

  if (currentCount >= maxListings) {
    return actionError(
      `وصلت للحد الأقصى من القوائم (${maxListings})`,
      "LISTING_LIMIT_REACHED",
    );
  }

  // ── Rate limit ──
  const rateLimitKey = `listing_create:${userId}`;
  const alreadyCreated = await redis.get(rateLimitKey);

  if (alreadyCreated) {
    return actionError(
      "يمكنك إنشاء قائمة واحدة فقط كل 24 ساعة",
      "RATE_LIMITED",
    );
  }

  // ── Validation ──
  const parsed = CreateListingSchema.safeParse(rawData);
  if (!parsed.success) {
    return actionError(
      parsed.error.issues[0]?.message ?? "بيانات غير صحيحة",
      "VALIDATION_ERROR",
    );
  }
  const data = parsed.data;

  // ── Category/City checks ──
  try {
    await validateCategoryAndSubcategory(data.categoryId, data.subcategoryId);
  } catch (err) {
    return actionError(
      err instanceof Error ? err.message : "تصنيف غير صالح",
      "INVALID_CATEGORY",
    );
  }

  const city = await prisma.city.findUnique({
    where: { id: data.cityId },
    select: { id: true },
  });
  if (!city) return actionError("المدينة غير موجودة", "INVALID_CITY");

  // ── DB write ──
  try {
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
    // هنا فقط نستخدم throw للأخطاء غير المتوقعة
    console.error("[createListingAction]", err);
    return actionError("حدث خطأ غير متوقع، حاول مرة أخرى", "UNEXPECTED_ERROR");
  }
}

export async function updateListingAction(
  listingId: string,
  step: "basic" | "contact" | "hours" | "social",
  rawData: unknown,
) {
  const session = await requireVerifiedOwnerSession();

  const existing = await prisma.businessProfile.findFirst({
    where: {
      id: listingId,
      ownerId: session.user.id,
      deletedAt: null,
    },
    include: {
      category: true,
      city: true,
      phoneNumbers: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      workingHours: {
        orderBy: { dayOfWeek: "asc" },
      },
      socialLinks: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!existing) {
    throw new Error("Listing not found");
  }

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
      include: {
        city: true,
        category: true,
      },
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

    return { ok: true, slug: updated.slug };
  }

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

      await tx.phoneNumber.deleteMany({
        where: {
          businessId: existing.id,
        },
      });

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

    return { ok: true };
  }

  if (step === "hours") {
    const data = UpdateHoursSchema.parse(rawData);

    await prisma.$transaction(async (tx) => {
      await tx.workingHours.deleteMany({
        where: {
          businessId: existing.id,
        },
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
      include: {
        city: true,
        category: true,
      },
    });

    await revalidateListingPublicPaths(refreshed);

    return { ok: true };
  }

  if (step === "social") {
    const data = UpdateSocialSchema.parse(rawData);

    await prisma.$transaction(async (tx) => {
      await tx.socialLink.deleteMany({
        where: {
          businessId: existing.id,
        },
      });

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
      newValues: {
        socialLinks: data.socialLinks,
      },
    });

    const refreshed = await prisma.businessProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        city: true,
        category: true,
      },
    });

    await revalidateListingPublicPaths(refreshed);

    return { ok: true };
  }

  throw new Error("Invalid update step");
}

export async function submitListingAction(listingId: string) {
  const session = await requireVerifiedOwnerSession();

  const listing = await prisma.businessProfile.findFirst({
    where: {
      id: listingId,
      ownerId: session.user.id,
      deletedAt: null,
    },
    include: {
      city: true,
      category: true,
      phoneNumbers: true,
    },
  });

  if (!listing) {
    throw new Error("Listing not found");
  }

  if (!canTransitionTo(listing.status, "ACTIVE")) {
    throw new Error("Listing cannot be submitted from current state");
  }

  if (!listing.nameAr || !listing.categoryId || !listing.cityId) {
    throw new Error("Required listing fields are missing");
  }

  if (listing.phoneNumbers.length === 0) {
    throw new Error("At least one phone number is required");
  }

  const updated = await prisma.businessProfile.update({
    where: { id: listing.id },
    data: {
      status: "ACTIVE",
      publishedAt: listing.publishedAt ?? new Date(),
    },
    include: {
      city: true,
      category: true,
    },
  });

  writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role,
    action: "LISTING_SUBMITTED",
    entityType: "BusinessProfile",
    entityId: updated.id,
    previousValues: { status: listing.status },
    newValues: {
      status: updated.status,
      publishedAt: updated.publishedAt,
    },
  });

  await revalidateListingPublicPaths(updated);

  return {
    ok: true,
    status: updated.status,
  };
}

export async function softDeleteListingAction(listingId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);

  const listing = await prisma.businessProfile.findFirst({
    where: {
      id: listingId,
      deletedAt: null,
      ...(isAdmin ? {} : { ownerId: session.user.id }),
    },
    include: {
      city: true,
      category: true,
    },
  });

  if (!listing) {
    throw new Error("Listing not found");
  }

  const deletedAt = new Date();

  await prisma.businessProfile.update({
    where: { id: listing.id },
    data: {
      deletedAt,
      deletedBy: session.user.id,
    },
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

  return { ok: true };
}
