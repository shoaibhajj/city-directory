Absolutely — here is a **fully polished Phase 3 markdown section** in the same style as your current README, with a table of contents, nested headings, shorter code blocks, and comments inside code to explain **what we did and why**. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

---

## 5. Phase 3 — Category & CMS System

### Table of Contents

1. [Phase Goal](#phase-goal)
2. [Theory](#theory)
3. [Implementation Plan](#implementation-plan)
4. [Files We Added](#files-we-added)
5. [Code Walkthrough](#code-walkthrough)
6. [Redis Cache Verification](#redis-cache-verification)
7. [Done Criteria](#done-criteria)
8. [What This Phase Teaches](#what-this-phase-teaches)

---

### Phase Goal

Super Admin can create, edit, reorder, and toggle visibility of categories and subcategories at runtime — no code deploy needed. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
This phase exists because categories are business content, so they belong in the database, not in TypeScript enums or hardcoded arrays. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
The public site reads visible categories through a Redis-cached API, while the admin UI manages the full category structure from a dedicated CMS screen. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

---

### Theory

#### Why database-driven categories?

A junior engineer might hardcode categories in code because it feels simple at first. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
That approach fails the moment the admin asks for a new category like “Gyms” or wants to hide one without redeploying the app. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
Database-driven categories let non-developers change content at runtime, which is exactly what a CMS should do. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### Why cache categories?

Category reads happen far more often than category writes. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
That makes categories a perfect fit for Redis caching, because the public directory benefits from fast reads while admin changes remain rare and easy to invalidate. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
We cache the public result in `categories:all` and delete that key after every mutation so the next read rebuilds fresh data from PostgreSQL. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### Why block delete?

A category must not be deleted if active listings still depend on it. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
Without that guard, the directory could end up with broken relationships or orphaned listings. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
So the delete flow checks for active listings first, and returns a clear error message if the category is still in use. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### Why reorder in a transaction?

Reordering changes multiple rows at once, so it must either fully succeed or fail safely. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
A Prisma transaction ensures the ordering stays consistent even if something goes wrong halfway through. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
That is the correct pattern for a bulk state change like display order. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

---

### Implementation Plan

#### 1. Add schemas

We created Zod schemas for category and subcategory create/update actions. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
These schemas validate bilingual names, optional slugs, icons, visibility, descriptions, and display order. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
Slug generation is handled from `nameEn` when the admin does not type one manually. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### 2. Add query layer

We created query functions for public and admin reads. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
`getAllCategories()` checks Redis first, falls back to Prisma on cache miss, then writes the response back with a 10-minute TTL. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
The admin query bypasses the public cache so the CMS always sees the latest state. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### 3. Add server actions

We created server actions for create, update, delete, reorder, and subcategory CRUD. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
Each action checks Super Admin permission, validates the payload, performs the database write, invalidates cache, and writes an audit log. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
This keeps all privileged business logic in the middle layer where the security boundary belongs. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### 4. Add public API routes

We created `/api/v1/categories` for public reads and separate protected routes for write operations. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
The public route returns only visible categories and visible subcategories. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
The write routes are protected so only Super Admin users can mutate the structure. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### 5. Add admin UI

We added the admin categories page, drag-and-drop sorting, category forms, delete confirmation, and modal-driven create/edit flows. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
The UI is Arabic-first and shows both Arabic and English names in each row so admins can manage bilingual content clearly. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
This gives the Super Admin a real CMS experience instead of a plain table editor. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

---

### Files We Added

#### `src/features/categories/schemas.ts`

This file defines the input rules for categories and subcategories. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
We keep validation here so both the server actions and API routes can reuse the same contract. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### `src/features/categories/queries.ts`

This file reads categories from PostgreSQL and manages Redis cache for the public read path. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
We keep cache logic here because reads and invalidation belong together. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### `src/features/categories/actions.ts`

This file holds all category mutation logic. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
It is where we enforce permissions, validate input, write to the database, invalidate cache, and log changes. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### `src/app/api/v1/categories/route.ts`

This file exposes the public category endpoint. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
It returns visible categories and can be cached safely because writes always invalidate the cache key. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### `src/app/api/v1/categories/[id]/route.ts`

This file handles update and delete for a single category. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
It exists so external consumers and future mobile clients can still use the same versioned API contract. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### `src/app/api/v1/categories/reorder/route.ts`

This file handles bulk reorder requests. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
It accepts the new order array and persists it in one transaction. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### `src/app/[locale]/(admin)/admin/categories/page.tsx`

This file renders the admin CMS page. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
It fetches fresh admin data on the server and passes it to the interactive client shell. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

#### `src/app/[locale]/(admin)/admin/categories/CategoriesClient.tsx`

This file manages client-side modal state, visibility toggles, and drag-and-drop actions. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
We keep it separate from the server page so the admin interface stays interactive without breaking the security boundary. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

---

### Code Walkthrough

#### Zod schemas

```ts
import { z } from "zod";

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/-+/g, "-");
}

// Why: category names come from the admin UI, so we validate them before
// they ever reach Prisma. This keeps bad data out of the database.
export const CreateCategorySchema = z.object({
  nameAr: z.string().min(2, "الاسم بالعربية مطلوب").max(100),
  nameEn: z.string().min(2, "English name is required").max(100),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  icon: z.string().max(50).optional().nullable(),
  isVisible: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
  descriptionAr: z.string().max(500).optional().nullable(),
  descriptionEn: z.string().max(500).optional().nullable(),
});

export { toSlug };
```

#### Category queries with Redis

```ts
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const CACHE_KEY = "categories:all";
const CACHE_TTL_SECONDS = 600;

// Why: this is the public read path, so we check Redis first.
// If the cache is warm, we avoid a database hit.
export async function getAllCategories() {
  const cached = await redis.get(CACHE_KEY);
  if (cached) return cached;

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

  // Why: public category data is read-heavy, so we cache it for 10 minutes.
  await redis.set(CACHE_KEY, rows, { ex: CACHE_TTL_SECONDS });
  return rows;
}

export async function invalidateCategoriesCache() {
  // Why: every category mutation must clear the public cache immediately.
  await redis.del(CACHE_KEY);
}
```

#### Category actions

```ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { invalidateCategoriesCache } from "./queries";
import { CreateCategorySchema, toSlug } from "./schemas";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  if (session.user.role !== "SUPERADMIN") throw new Error("FORBIDDEN");
  return session.user;
}

// Why: the slug must be unique so public category URLs stay stable.
async function ensureUniqueCategorySlug(base: string, excludeId?: string) {
  let slug = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${++counter}`;
  }
}

export async function createCategory(data: unknown) {
  const actor = await requireSuperAdmin();
  const parsed = CreateCategorySchema.parse(data);

  const slug = await ensureUniqueCategorySlug(
    parsed.slug ?? toSlug(parsed.nameEn),
  );

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

  // Why: homepage and public directory must see the new category immediately.
  await invalidateCategoriesCache();

  // Why: admin actions must leave an audit trail.
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email ?? null,
    actorRole: actor.role,
    action: "CREATE",
    entityType: "Category",
    entityId: category.id,
    newValues: category,
  });

  return { success: true, data: category };
}
```

#### Public API route

```ts
import { NextResponse } from "next/server";
import { getAllCategories } from "@/features/categories/queries";

export async function GET() {
  try {
    const categories = await getAllCategories();

    // Why: public reads are cacheable because category writes always invalidate.
    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}
```

#### Admin page

```tsx
import { getAllCategoriesAdmin } from "@/features/categories/queries";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = "force-dynamic";

// Why: admin should always see the latest data, not a cached render.
export default async function AdminCategoriesPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPERADMIN") {
    redirect("/ar/sign-in");
  }

  const categories = await getAllCategoriesAdmin();

  return (
    <main className="p-6 max-w-3xl mx-auto" dir="rtl">
      <CategoriesClient categories={categories} />
    </main>
  );
}
```

---

### Redis Cache Verification

Because the project now uses Upstash Redis, cache inspection should be done through the Upstash console or REST API. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
The key you should verify is `categories:all`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
After the first successful public request, that key should exist and contain the serialized category payload. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

```bash
curl -s \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/get/categories:all"
```

If the cache is warm, the response should return the stored JSON payload. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
If the key is missing, the response should return `null`, and the next public request should repopulate it. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

---

### Done Criteria

- Super Admin can create a new category and it appears on the homepage immediately. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
- Dragging categories into a new order and saving persists the order. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
- Deleting a category that has listings returns a clear error message. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
- `GET /api/v1/categories` returns a cached response on the second call, and `categories:all` is visible in Upstash. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

---

### What This Phase Teaches

Phase 3 is a small phase technically, but it teaches a very important pattern. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
Business content belongs in the database, public reads should be cached, privileged writes should pass through the security boundary, and every mutation should leave an audit trail. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)
That pattern will repeat in later phases for listings, media, settings, and admin workflows. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_2d6c9820-cd00-4aa1-a42f-7b4ffb3db9ac/cfb7ba98-c437-4a56-b3f5-ee3d8d597b4d/README.md)

---
