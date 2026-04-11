"use client";
"use no memo";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { Category, City, Subcategory } from "@prisma/client";
import {
  CreateListingSchema,
  type CreateListingInput,
} from "@/features/business/schemas";
import { createListingAction } from "@/features/business/actions";

type Props = {
  categories: (Category & { subcategories: Subcategory[] })[];
  cities: City[];
  locale: string;
};

export function CreateListingForm({ categories, cities }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<CreateListingInput>({
    resolver: zodResolver(CreateListingSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      categoryId: "",
      cityId: "",
      subcategoryId: null,
    },
  });

  const selectedCategoryId = useWatch({
    control: form.control,
    name: "categoryId",
  });

  function onSubmit(data: CreateListingInput) {
    startTransition(async () => {
      try {
        const result = await createListingAction(data);
        if (result.ok) {
          router.push(`/dashboard/listings/${result?.data.id}` as never);
        } else {
          alert(result.error);
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "حدث خطأ ما");
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">الاسم بالعربية *</label>
        <input
          dir="rtl"
          className="w-full rounded-md border px-3 py-2"
          {...form.register("nameAr")}
        />
        {form.formState.errors.nameAr && (
          <p className="text-sm text-destructive">
            {form.formState.errors.nameAr.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">التصنيف *</label>
        <select
          className="w-full rounded-md border px-3 py-2"
          {...form.register("categoryId")}
        >
          <option value="">اختر التصنيف</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">التصنيف الفرعي</label>
        <select
          className="w-full rounded-md border px-3 py-2"
          {...form.register("subcategoryId")}
        >
          <option value="">بدون</option>
          {categories
            .find((c) => c.id === selectedCategoryId)
            ?.subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">المدينة *</label>
        <select
          className="w-full rounded-md border px-3 py-2"
          {...form.register("cityId")}
        >
          <option value="">اختر المدينة</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending || !form.formState.isValid}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isPending ? "جارٍ الإنشاء..." : "إنشاء وتعديل"}
      </button>
    </form>
  );
}
