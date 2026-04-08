import { z } from "zod";

export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const nameArField = z
  .string()
  .min(2, "الاسم بالعربية مطلوب (حرفان على الأقل)")
  .max(100);

const nameEnField = z
  .string()
  .min(2, "Name in English is required (min 2 chars)")
  .max(100);

const slugField = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens only")
  .optional();

// WHY no .default() here?
// Zod's .default() splits the type into input (optional) vs output (required).
// React Hook Form's useForm<T> expects the output type, but zodResolver injects
// the input type — causing the "undefined is not assignable to boolean" error.
// Solution: remove .default() from Zod entirely.
// Defaults are handled by defaultValues in useForm(), which is the correct place.
const sharedFields = {
  nameAr: nameArField,
  nameEn: nameEnField,
  slug: slugField,
  icon: z.string().max(10).optional().nullable(),
  isVisible: z.boolean(), // ← no .default(true)
  displayOrder: z.number().int().min(0), // ← no .default(0)
  descriptionAr: z.string().max(500).optional().nullable(),
  descriptionEn: z.string().max(500).optional().nullable(),
};

export const CreateCategorySchema = z.object(sharedFields);

export const UpdateCategorySchema = z
  .object(sharedFields)
  .partial()
  .extend({ id: z.string().cuid() });

export const CreateSubcategorySchema = z.object({
  ...sharedFields,
  categoryId: z.string().cuid(),
});

export const UpdateSubcategorySchema = z
  .object({ ...sharedFields, categoryId: z.string().cuid() })
  .partial()
  .extend({ id: z.string().cuid() });

export const ReorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().cuid(),
        displayOrder: z.number().int().min(0),
      }),
    )
    .min(1),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CreateSubcategoryInput = z.infer<typeof CreateSubcategorySchema>;
export type UpdateSubcategoryInput = z.infer<typeof UpdateSubcategorySchema>;
export type ReorderInput = z.infer<typeof ReorderSchema>;
