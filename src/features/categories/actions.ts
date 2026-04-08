"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { invalidateCategoriesCache } from "./queries";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CreateSubcategorySchema,
  UpdateSubcategorySchema,
  ReorderSchema,
  toSlug,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CreateSubcategoryInput,
  type UpdateSubcategoryInput,
  type ReorderInput,
} from "./schemas";

// ── Auth guard ────────────────────────────────────────────────────────────────
// Role enum value is SUPER_ADMIN (with underscore) — matches schema.prisma
async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  if (session.user.role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
  return session.user;
}

// ── Slug collision resolution ─────────────────────────────────────────────────
async function uniqueCategorySlug(base: string, excludeId?: string) {
  let slug = base;
  let n = 1;
  for (;;) {
    const hit = await prisma.category.findUnique({ where: { slug } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${++n}`;
  }
}

async function uniqueSubcategorySlug(base: string, excludeId?: string) {
  let slug = base;
  let n = 1;
  for (;;) {
    const hit = await prisma.subcategory.findUnique({ where: { slug } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${++n}`;
  }
}

// ── Revalidation helper ───────────────────────────────────────────────────────
function revalidateAll() {
  revalidatePath("/[locale]/(admin)/admin/categories", "page");
  revalidatePath("/[locale]/(public)", "layout");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function createCategory(data: CreateCategoryInput) {
  const actor = await requireSuperAdmin();
  const parsed = CreateCategorySchema.parse(data);
  const slug = await uniqueCategorySlug(parsed.slug ?? toSlug(parsed.nameEn));

  const category = await prisma.category.create({
    data: {
      nameAr: parsed.nameAr,
      nameEn: parsed.nameEn,
      slug,
      icon: parsed.icon ?? null,
      isVisible: parsed.isVisible,
      displayOrder: parsed.displayOrder,
      descriptionAr: parsed.descriptionAr ?? null,
      descriptionEn: parsed.descriptionEn ?? null,
    },
  });

  await Promise.all([
    invalidateCategoriesCache(),
    writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email ?? null,
      actorRole: actor.role,
      action: AuditAction.CATEGORY_CREATED,
      entityType: "Category",
      entityId: category.id,
      newValues: category as Record<string, unknown>,
    }),
  ]);

  revalidateAll();
  return { success: true as const, data: category };
}

export async function updateCategory(data: UpdateCategoryInput) {
  const actor = await requireSuperAdmin();
  const parsed = UpdateCategorySchema.parse(data);
  const { id, ...fields } = parsed;

  const existing = await prisma.category.findUniqueOrThrow({ where: { id } });

  // Recompute slug only when the user explicitly changed it or changed nameEn
  let slug = existing.slug;
  if (fields.slug && fields.slug !== existing.slug) {
    slug = await uniqueCategorySlug(fields.slug, id);
  } else if (
    fields.nameEn &&
    fields.nameEn !== existing.nameEn &&
    !fields.slug
  ) {
    slug = await uniqueCategorySlug(toSlug(fields.nameEn), id);
  }

  const updated = await prisma.category.update({
    where: { id },
    data: { ...fields, slug },
  });

  await Promise.all([
    invalidateCategoriesCache(),
    writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email ?? null,
      actorRole: actor.role,
      action: AuditAction.CATEGORY_UPDATED,
      entityType: "Category",
      entityId: id,
      previousValues: existing as Record<string, unknown>,
      newValues: updated as Record<string, unknown>,
    }),
  ]);

  revalidateAll();
  return { success: true as const, data: updated };
}

export async function deleteCategory(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const actor = await requireSuperAdmin();

  // Data-integrity guard — block if ACTIVE listings exist under this category.
  // The relation on BusinessProfile is `categoryId` FK — query it directly.
  const activeCount = await prisma.businessProfile.count({
    where: { categoryId: id, status: "ACTIVE", deletedAt: null },
  });

  if (activeCount > 0) {
    return {
      success: false,
      error: `لا يمكن حذف هذا التصنيف — يحتوي على ${activeCount} إعلان نشط. نقل الإعلانات أو تعطيل التصنيف أولاً.`,
    };
  }

  const existing = await prisma.category.findUniqueOrThrow({ where: { id } });

  await prisma.$transaction([
    prisma.subcategory.deleteMany({ where: { categoryId: id } }),
    prisma.category.delete({ where: { id } }),
  ]);

  await Promise.all([
    invalidateCategoriesCache(),
    writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email ?? null,
      actorRole: actor.role,
      action: AuditAction.CATEGORY_DELETED,
      entityType: "Category",
      entityId: id,
      previousValues: existing as Record<string, unknown>,
    }),
  ]);

  revalidateAll();
  return { success: true };
}

export async function reorderCategories(data: ReorderInput) {
  const actor = await requireSuperAdmin();
  const parsed = ReorderSchema.parse(data);

  // Single transaction — all updates succeed or all fail together
  await prisma.$transaction(
    parsed.items.map(({ id, displayOrder }) =>
      prisma.category.update({ where: { id }, data: { displayOrder } }),
    ),
  );

  await Promise.all([
    invalidateCategoriesCache(),
    writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email ?? null,
      actorRole: actor.role,
      action: AuditAction.CATEGORY_REORDERED,
      entityType: "Category",
      entityId: "bulk",
      newValues: { order: parsed.items },
    }),
  ]);

  revalidatePath("/[locale]/(admin)/admin/categories", "page");
  return { success: true as const };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBCATEGORY ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function createSubcategory(data: CreateSubcategoryInput) {
  const actor = await requireSuperAdmin();
  const parsed = CreateSubcategorySchema.parse(data);
  const slug = await uniqueSubcategorySlug(
    parsed.slug ?? toSlug(parsed.nameEn),
  );

  const sub = await prisma.subcategory.create({
    data: {
      categoryId: parsed.categoryId,
      nameAr: parsed.nameAr,
      nameEn: parsed.nameEn,
      slug,
      icon: parsed.icon ?? null,
      isVisible: parsed.isVisible,
      displayOrder: parsed.displayOrder,
      descriptionAr: parsed.descriptionAr ?? null,
      descriptionEn: parsed.descriptionEn ?? null,
    },
  });

  await Promise.all([
    invalidateCategoriesCache(),
    writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email ?? null,
      actorRole: actor.role,
      action: AuditAction.CATEGORY_CREATED,
      entityType: "Subcategory",
      entityId: sub.id,
      newValues: sub as Record<string, unknown>,
    }),
  ]);

  revalidateAll();
  return { success: true as const, data: sub };
}

export async function updateSubcategory(data: UpdateSubcategoryInput) {
  const actor = await requireSuperAdmin();
  const parsed = UpdateSubcategorySchema.parse(data);
  const { id, ...fields } = parsed;

  const existing = await prisma.subcategory.findUniqueOrThrow({
    where: { id },
  });

  let slug = existing.slug;
  if (fields.slug && fields.slug !== existing.slug) {
    slug = await uniqueSubcategorySlug(fields.slug, id);
  } else if (
    fields.nameEn &&
    fields.nameEn !== existing.nameEn &&
    !fields.slug
  ) {
    slug = await uniqueSubcategorySlug(toSlug(fields.nameEn), id);
  }

  const updated = await prisma.subcategory.update({
    where: { id },
    data: { ...fields, slug },
  });

  await Promise.all([
    invalidateCategoriesCache(),
    writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email ?? null,
      actorRole: actor.role,
      action: AuditAction.CATEGORY_UPDATED,
      entityType: "Subcategory",
      entityId: id,
      previousValues: existing as Record<string, unknown>,
      newValues: updated as Record<string, unknown>,
    }),
  ]);

  revalidateAll();
  return { success: true as const, data: updated };
}

export async function deleteSubcategory(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const actor = await requireSuperAdmin();

  const activeCount = await prisma.businessProfile.count({
    where: { subcategoryId: id, status: "ACTIVE", deletedAt: null },
  });

  if (activeCount > 0) {
    return {
      success: false,
      error: `لا يمكن الحذف — ${activeCount} إعلان نشط مرتبط بهذا التصنيف الفرعي.`,
    };
  }

  const existing = await prisma.subcategory.findUniqueOrThrow({
    where: { id },
  });
  await prisma.subcategory.delete({ where: { id } });

  await Promise.all([
    invalidateCategoriesCache(),
    writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email ?? null,
      actorRole: actor.role,
      action: AuditAction.CATEGORY_DELETED,
      entityType: "Subcategory",
      entityId: id,
      previousValues: existing as Record<string, unknown>,
    }),
  ]);

  revalidateAll();
  return { success: true };
}

export async function reorderSubcategories(data: ReorderInput) {
  await requireSuperAdmin();
  const parsed = ReorderSchema.parse(data);

  await prisma.$transaction(
    parsed.items.map(({ id, displayOrder }) =>
      prisma.subcategory.update({ where: { id }, data: { displayOrder } }),
    ),
  );

  await invalidateCategoriesCache();
  revalidatePath("/[locale]/(admin)/admin/categories", "page");
  return { success: true as const };
}
