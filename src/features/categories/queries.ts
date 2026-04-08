import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const CACHE_KEY = "categories:all";
const CACHE_TTL_SECONDS = 600; // 10 minutes

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DERIVATION — types are inferred from the actual Prisma query shape.
//
// WHY: If you write manual types (`type X = { id: string; nameAr: string }`)
// and later change the schema, the manual type silently drifts. TypeScript
// won't catch it because the manual type compiles on its own.
//
// Correct pattern: define a private function that mirrors the query, then
// derive the exported type with Awaited<ReturnType<...>>[number].
// After every `prisma generate`, types update automatically. Zero manual sync.
// ─────────────────────────────────────────────────────────────────────────────

// Private — for type inference only, never called at runtime

function _publicCategoryQuery() {
  return prisma.category.findMany({
    where: { isVisible: true },
    orderBy: { displayOrder: "asc" },
    include: {
      subcategories: {
        where: { isVisible: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });
}

// Private — for admin type inference only, never called at runtime
// NOTE: the relation on Category is named `listings` (see schema.prisma).
// It is NOT `businessProfiles`. Always check the schema before writing _count.

function _adminCategoryQuery() {
  return prisma.category.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      subcategories: { orderBy: { displayOrder: "asc" } },
      _count: {
        select: { listings: true }, // ← "listings" matches schema.prisma
      },
    },
  });
}

// ── Exported types ────────────────────────────────────────────────────────────
export type CategoryPublic = Awaited<
  ReturnType<typeof _publicCategoryQuery>
>[number];
export type SubcategoryPublic = CategoryPublic["subcategories"][number];
export type AdminCategory = Awaited<
  ReturnType<typeof _adminCategoryQuery>
>[number];

// ── Cache invalidation ────────────────────────────────────────────────────────
export async function invalidateCategoriesCache(): Promise<void> {
  await redis.del(CACHE_KEY);
}

// ── Public query — Redis cached, visible categories only ──────────────────────
export async function getAllCategories(): Promise<CategoryPublic[]> {
  // 1. Try Redis cache (Upstash client auto-deserialises JSON)
  const cached = await redis.get<CategoryPublic[]>(CACHE_KEY);
  if (cached) return cached;

  // 2. Cache miss — query DB
  const rows = await prisma.category.findMany({
    where: { isVisible: true },
    orderBy: { displayOrder: "asc" },
    include: {
      subcategories: {
        where: { isVisible: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  // 3. Write cache — no type cast needed, type flows from the query
  await redis.set(CACHE_KEY, rows, { ex: CACHE_TTL_SECONDS });
  return rows;
}

// ── Admin query — no cache, always fresh ─────────────────────────────────────
export async function getAllCategoriesAdmin(): Promise<AdminCategory[]> {
  return prisma.category.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      subcategories: { orderBy: { displayOrder: "asc" } },
      _count: { select: { listings: true } },
    },
  });
}

// ── Targeted lookups ──────────────────────────────────────────────────────────
export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      subcategories: {
        where: { isVisible: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });
}

export async function getCategoryWithSubcategories(id: string) {
  return prisma.category.findUnique({
    where: { id },
    include: { subcategories: { orderBy: { displayOrder: "asc" } } },
  });
}
