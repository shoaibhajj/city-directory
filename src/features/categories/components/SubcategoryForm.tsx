"use client";

import { useEffect, useId, useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateSubcategorySchema,
  toSlug,
  type CreateSubcategoryInput,
} from "../schemas";
import { createSubcategory, updateSubcategory } from "../actions";

const ICONS = [
  "💊",
  "🏥",
  "🍽️",
  "🛒",
  "🚗",
  "🥖",
  "💈",
  "👗",
  "🧱",
  "⚙️",
  "📚",
  "☕",
  "🏋️",
  "🏦",
  "🏪",
  "🔧",
  "🎓",
  "🧹",
  "💻",
  "📦",
];

interface Props {
  categoryId: string;
  initial?: Partial<CreateSubcategoryInput> & { id?: string };
  onSuccess: () => void;
  onCancel: () => void;
}

export function SubcategoryForm({
  categoryId,
  initial,
  onSuccess,
  onCancel,
}: Props) {
  const formId = useId();
  const isEditing = Boolean(initial?.id);
  const [isPending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateSubcategoryInput>({
    resolver: zodResolver(CreateSubcategorySchema),
    defaultValues: {
      categoryId,
      nameAr: initial?.nameAr ?? "",
      nameEn: initial?.nameEn ?? "",
      slug: initial?.slug ?? "",
      icon: initial?.icon ?? null,
      isVisible: initial?.isVisible ?? true,
      displayOrder: initial?.displayOrder ?? 0,
      descriptionAr: initial?.descriptionAr ?? "",
      descriptionEn: initial?.descriptionEn ?? "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const nameEn = watch("nameEn");
  const selectedIcon = watch("icon");

  useEffect(() => {
    if (!isEditing) {
      setValue("slug", toSlug(nameEn), { shouldValidate: false });
    }
  }, [nameEn, isEditing, setValue]);

  function onSubmit(data: CreateSubcategoryInput) {
    setRootError(null);
    startTransition(async () => {
      try {
        if (isEditing && initial?.id) {
          await updateSubcategory({ ...data, id: initial.id });
        } else {
          await createSubcategory(data);
        }
        onSuccess();
      } catch (err: unknown) {
        setRootError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      dir="rtl"
      noValidate
    >
      {rootError && (
        <p
          role="alert"
          className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md"
        >
          {rootError}
        </p>
      )}

      <div className="space-y-1">
        <label
          htmlFor={`${formId}-nameAr`}
          className="block text-sm font-medium"
        >
          الاسم بالعربية{" "}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </label>
        <input
          id={`${formId}-nameAr`}
          {...register("nameAr")}
          dir="rtl"
          placeholder="مثال: أدوية مزمنة"
          className="w-full px-3 py-2 rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        />
        {errors.nameAr && (
          <p className="text-xs text-destructive">{errors.nameAr.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`${formId}-nameEn`}
          className="block text-sm font-medium"
        >
          الاسم بالإنجليزية{" "}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </label>
        <input
          id={`${formId}-nameEn`}
          {...register("nameEn")}
          dir="ltr"
          placeholder="e.g. Chronic Medications"
          className="w-full px-3 py-2 rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        />
        {errors.nameEn && (
          <p className="text-xs text-destructive">{errors.nameEn.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor={`${formId}-slug`} className="block text-sm font-medium">
          الـ Slug
        </label>
        <input
          id={`${formId}-slug`}
          {...register("slug")}
          dir="ltr"
          className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
        />
        {errors.slug && (
          <p className="text-xs text-destructive">{errors.slug.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">أيقونة</p>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() =>
                setValue("icon", selectedIcon === icon ? null : icon)
              }
              aria-pressed={selectedIcon === icon}
              className={`w-9 h-9 text-lg rounded-md border-2 transition-colors ${
                selectedIcon === icon
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
        <input
          type="checkbox"
          {...register("isVisible")}
          className="w-4 h-4 rounded border-input accent-primary"
        />
        ظاهر للزوار
      </label>

      <div className="flex gap-3 pt-3 border-t border-border">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {isPending
            ? "جارٍ الحفظ…"
            : isEditing
              ? "حفظ التعديلات"
              : "إضافة التصنيف الفرعي"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-5 py-2 border border-border rounded-md text-sm hover:bg-accent transition-colors disabled:opacity-60"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
