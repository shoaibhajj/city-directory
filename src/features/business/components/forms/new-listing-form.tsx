// src/components/business/forms/new-listing-form.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createListingAction } from "@/features/business/actions";

type Category = { id: string; nameAr: string; nameEn: string | null };
type City = { id: string; nameAr: string; name: string };

interface Props {
  categories?: Category[];
  cities?: City[];
}

export function NewListingForm({ categories = [], cities = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);

    const payload = {
      nameAr: String(fd.get("nameAr") ?? ""),
      nameEn: String(fd.get("nameEn") ?? "") || undefined,
      descriptionAr: String(fd.get("descriptionAr") ?? "") || undefined,
      descriptionEn: String(fd.get("descriptionEn") ?? "") || undefined,
      categoryId: String(fd.get("categoryId") ?? ""),
      subcategoryId: String(fd.get("subcategoryId") ?? "") || null,
      cityId: String(fd.get("cityId") ?? ""),
    };

    startTransition(async () => {
      const result = await createListingAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/dashboard/listings/${result.data.id}` as never);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border bg-card p-6"
    >
      {/* ── Error Banner ── */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* ── Arabic Name ── */}
      <div className="space-y-1">
        <label htmlFor="nameAr" className="text-sm font-medium">
          الاسم بالعربية <span className="text-destructive">*</span>
        </label>
        <input
          id="nameAr"
          name="nameAr"
          required
          dir="rtl"
          placeholder="مثال: صيدلية النور"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* ── English Name ── */}
      <div className="space-y-1">
        <label htmlFor="nameEn" className="text-sm font-medium">
          الاسم بالإنجليزية
        </label>
        <input
          id="nameEn"
          name="nameEn"
          dir="ltr"
          placeholder="e.g. Al-Nour Pharmacy"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* ── Description AR ── */}
      <div className="space-y-1">
        <label htmlFor="descriptionAr" className="text-sm font-medium">
          الوصف بالعربية
        </label>
        <textarea
          id="descriptionAr"
          name="descriptionAr"
          rows={3}
          dir="rtl"
          placeholder="وصف مختصر عن النشاط التجاري..."
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* ── Category ── */}
      <div className="space-y-1">
        <label htmlFor="categoryId" className="text-sm font-medium">
          التصنيف <span className="text-destructive">*</span>
        </label>
        {categories.length === 0 ? (
          <p className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
            ⚠️ لا توجد تصنيفات — أضف تصنيفات من لوحة الأدمن أولاً
          </p>
        ) : (
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue=""
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              اختر التصنيف
            </option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nameAr}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── City ── */}
      <div className="space-y-1">
        <label htmlFor="cityId" className="text-sm font-medium">
          المدينة <span className="text-destructive">*</span>
        </label>
        {cities.length === 0 ? (
          <p className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
            ⚠️ لا توجد مدن — أضف مدناً من لوحة الأدمن أولاً
          </p>
        ) : (
          <select
            id="cityId"
            name="cityId"
            required
            defaultValue=""
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              اختر المدينة
            </option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.nameAr}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={isPending || categories.length === 0 || cities.length === 0}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "جارٍ الإنشاء..." : "إنشاء المسودة والمتابعة ←"}
      </button>
    </form>
  );
}
