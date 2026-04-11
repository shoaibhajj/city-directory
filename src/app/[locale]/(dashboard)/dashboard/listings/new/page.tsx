// src/app/[locale]/(dashboard)/dashboard/listings/new/page.tsx
import { NewListingForm } from "@/features/business/components/forms/new-listing-form";
import { prisma } from "@/lib/prisma";

export default async function NewListingPage() {
  // جلب البيانات server-side لتعبئة الـ selects
  const [categories, cities] = await Promise.all([
    prisma.category.findMany({
      where: { isVisible: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, nameAr: true, nameEn: true },
    }),
    prisma.city.findMany({
      where: { isActive: true },
      orderBy: { nameAr: "asc" },
      select: { id: true, nameAr: true, name: true },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">إنشاء قائمة جديدة</h1>
        <p className="text-muted-foreground">
          ابدأ بالمعلومات الأساسية ثم أكمل بقية الخطوات.
        </p>
      </div>

      {/* Client Component يتولى الـ form state وعرض الأخطاء */}
      <NewListingForm categories={categories} cities={cities} />
    </div>
  );
}
