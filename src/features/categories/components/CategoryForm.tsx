"use client";

import { useEffect, useId, useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateCategorySchema,
  toSlug,
  type CreateCategoryInput,
} from "../schemas";
import { createCategory, updateCategory } from "../actions";

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
  initial?: Partial<CreateCategoryInput> & { id?: string };
  onSuccess: () => void;
  onCancel: () => void;
}

export function CategoryForm({ initial, onSuccess, onCancel }: Props) {
  const id = useId();
  const isEditing = Boolean(initial?.id);
  const [isPending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateCategoryInput>({
    resolver: zodResolver(CreateCategorySchema),
    defaultValues: {
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
  //   const currentSlug = watch("slug");
  const selectedIcon = watch("icon");

  // Auto-fill slug from nameEn only when creating (not editing)
  useEffect(() => {
    if (!isEditing) {
      setValue("slug", toSlug(nameEn), { shouldValidate: false });
    }
  }, [nameEn, isEditing, setValue]);

  function onSubmit(data: CreateCategoryInput) {
    setRootError(null);
    startTransition(async () => {
      try {
        if (isEditing && initial?.id) {
          await updateCategory({ ...data, id: initial.id });
        } else {
          await createCategory(data);
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

      {/* Arabic name */}
      <div className="space-y-1">
        <label htmlFor={`${id}-nameAr`} className="block text-sm font-medium">
          الاسم بالعربية{" "}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </label>
        <input
          id={`${id}-nameAr`}
          {...register("nameAr")}
          dir="rtl"
          placeholder="مثال: صيدليات"
          className="w-full px-3 py-2 rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        />
        {errors.nameAr && (
          <p className="text-xs text-destructive">{errors.nameAr.message}</p>
        )}
      </div>

      {/* English name */}
      <div className="space-y-1">
        <label htmlFor={`${id}-nameEn`} className="block text-sm font-medium">
          الاسم بالإنجليزية{" "}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </label>
        <input
          id={`${id}-nameEn`}
          {...register("nameEn")}
          dir="ltr"
          placeholder="e.g. Pharmacies"
          className="w-full px-3 py-2 rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        />
        {errors.nameEn && (
          <p className="text-xs text-destructive">{errors.nameEn.message}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-1">
        <label htmlFor={`${id}-slug`} className="block text-sm font-medium">
          الـ Slug
        </label>
        <input
          id={`${id}-slug`}
          {...register("slug")}
          dir="ltr"
          placeholder="pharmacies"
          className="w-full px-3 py-2 rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          يُعبأ تلقائياً من الاسم الإنجليزي — يمكنك تعديله
        </p>
        {errors.slug && (
          <p className="text-xs text-destructive">{errors.slug.message}</p>
        )}
      </div>

      {/* Icon picker */}
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

      {/* Descriptions */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor={`${id}-descAr`} className="block text-sm font-medium">
            الوصف بالعربية
          </label>
          <textarea
            id={`${id}-descAr`}
            {...register("descriptionAr")}
            dir="rtl"
            rows={2}
            placeholder="وصف اختياري…"
            className="w-full px-3 py-2 rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-descEn`} className="block text-sm font-medium">
            الوصف بالإنجليزية
          </label>
          <textarea
            id={`${id}-descEn`}
            {...register("descriptionEn")}
            dir="ltr"
            rows={2}
            placeholder="Optional description…"
            className="w-full px-3 py-2 rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
          />
        </div>
      </div>

      {/* isVisible + displayOrder */}
      <div className="flex items-center gap-6 pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input
            type="checkbox"
            {...register("isVisible")}
            className="w-4 h-4 rounded border-input accent-primary"
          />
          ظاهر للزوار
        </label>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={`${id}-order`}>الترتيب:</label>
          <input
            id={`${id}-order`}
            type="number"
            min={0}
            {...register("displayOrder", { valueAsNumber: true })}
            className="w-16 px-2 py-1 rounded-md border border-input bg-background text-center text-sm"
          />
        </div>
      </div>

      {/* Actions */}
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
              : "إنشاء التصنيف"}
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
