import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ListingsTable } from "./ListingsTable";

export const dynamic = "force-dynamic";

export default async function AdminListingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { locale } = await params;
  const { status = "ALL", q = "", page = "1" } = await searchParams;

  const t = await getTranslations("admin.listings");
  const pageNum = parseInt(page);
  const pageSize = 20;
  const skip = (pageNum - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = { deletedAt: null };
  if (status !== "ALL") {
    where.status = status;
  }
  if (q) {
    where.OR = [
      { nameAr: { contains: q } },
      { nameEn: { contains: q } },
      { owner: { email: { contains: q } } },
    ];
  }

  // Fetch listings
  const [listings, total] = await Promise.all([
    prisma.businessProfile.findMany({
      where,
      include: { 
        category: { select: { nameAr: true, nameEn: true } },
        owner: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.businessProfile.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Search & Filter */}
      <form className="flex gap-4">
        <input
          type="text"
          name="q"
          placeholder={t("searchPlaceholder")}
          defaultValue={q}
          className="flex-1 p-2 border rounded"
        />
        <select name="status" defaultValue={status} className="p-2 border rounded">
          <option value="ALL">{t("allStatuses")}</option>
          <option value="ACTIVE">{t("active")}</option>
          <option value="DRAFT">{t("draft")}</option>
          <option value="SUSPENDED">{t("suspended")}</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded">
          {t("filter")}
        </button>
      </form>

      {/* Table */}
      <ListingsTable
        locale={locale}
        listings={listings}
        totalPages={totalPages}
        currentPage={pageNum}
      />
    </div>
  );
}