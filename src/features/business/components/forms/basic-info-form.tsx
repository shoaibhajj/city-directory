"use client";
"use no memo";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  BusinessProfile,
  Category,
  City,
  Subcategory,
} from "@prisma/client";
import {
  UpdateBasicInfoSchema,
  type UpdateBasicInfoInput,
} from "@/features/business/schemas";
import { updateListingAction } from "@/features/business/actions";
import { useDebouncedAutosave } from "./use-debounced-autosave";
import { AutosaveIndicator } from "./autosave-indicator";
import { useWatch } from "react-hook-form";
type BasicInfoFormProps = {
  listing: Pick<
    BusinessProfile,
    | "id"
    | "nameAr"
    | "nameEn"
    | "descriptionAr"
    | "descriptionEn"
    | "categoryId"
    | "subcategoryId"
    | "cityId"
  >;
  categories: (Category & { subcategories: Subcategory[] })[];
  cities: City[];
};

export function BasicInfoForm({
  listing,
  categories,
  cities,
}: BasicInfoFormProps) {
  const form = useForm<UpdateBasicInfoInput>({
    resolver: zodResolver(UpdateBasicInfoSchema),
    defaultValues: {
      nameAr: listing.nameAr,
      nameEn: listing.nameEn ?? "",
      descriptionAr: listing.descriptionAr ?? "",
      descriptionEn: listing.descriptionEn ?? "",
      categoryId: listing.categoryId,
      subcategoryId: listing.subcategoryId ?? null,
      cityId: listing.cityId,
    },
    mode: "onChange",
  });

  const values = useWatch({ control: form.control });
  const selectedCategoryId = useWatch({
    control: form.control,
    name: "categoryId",
  });

  const handleSave = useCallback(
    async (next: UpdateBasicInfoInput) => {
      await updateListingAction(listing.id, "basic", next);
    },
    [listing.id],
  );

  const { state } = useDebouncedAutosave({
    value: values as UpdateBasicInfoInput,
    isValid: form.formState.isValid,
    onSave: handleSave,
    delay: 2000,
  });

  return (
    <form className="space-y-6">
      <AutosaveIndicator state={state} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="nameAr" className="text-sm font-medium">
            الاسم بالعربية
          </label>
          <input
            id="nameAr"
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
          <label htmlFor="nameEn" className="text-sm font-medium">
            Name in English
          </label>
          <input
            id="nameEn"
            dir="ltr"
            className="w-full rounded-md border px-3 py-2"
            {...form.register("nameEn")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="descriptionAr" className="text-sm font-medium">
          الوصف بالعربية
        </label>
        <textarea
          id="descriptionAr"
          dir="rtl"
          rows={5}
          className="w-full rounded-md border px-3 py-2"
          {...form.register("descriptionAr")}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="descriptionEn" className="text-sm font-medium">
          Description in English
        </label>
        <textarea
          id="descriptionEn"
          dir="ltr"
          rows={5}
          className="w-full rounded-md border px-3 py-2"
          {...form.register("descriptionEn")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="categoryId" className="text-sm font-medium">
            التصنيف
          </label>
          <select
            id="categoryId"
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
          <label htmlFor="subcategoryId" className="text-sm font-medium">
            التصنيف الفرعي
          </label>
          <select
            id="subcategoryId"
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
          <label htmlFor="cityId" className="text-sm font-medium">
            المدينة
          </label>
          <select
            id="cityId"
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
      </div>
    </form>
  );
}
