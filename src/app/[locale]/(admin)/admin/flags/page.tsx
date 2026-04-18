import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { FlagsTable } from "./FlagsTable";

export const dynamic = "force-dynamic";

export default async function AdminFlagsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const { status = "PENDING", page = "1" } = await searchParams;

  const t = await getTranslations("admin.flags");
  const pageNum = parseInt(page);
  const pageSize = 20;
  const skip = (pageNum - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (status !== "ALL") {
    where.status = status;
  }

  const [flags, totalFlags] = await Promise.all([
    prisma.reviewFlag.findMany({
      where,
      include: {
        business: { select: { nameAr: true, nameEn: true, slug: true } },
        reportedBy: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.reviewFlag.count({ where }),
  ]);

  const totalPages = Math.ceil(totalFlags / pageSize);

  // Return data for pagination
  void totalPages;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        <a
          href="admin/flags?status=PENDING"
          className={`px-4 py-2 rounded ${
            status === "PENDING" ? "bg-primary text-white" : "bg-gray-100"
          }`}
        >
          {t("pending")}
        </a>
        <a
          href="admin/flags?status=RESOLVED"
          className={`px-4 py-2 rounded ${
            status === "RESOLVED" ? "bg-primary text-white" : "bg-gray-100"
          }`}
        >
          {t("resolved")}
        </a>
        <a
          href="admin/flags?status=ALL"
          className={`px-4 py-2 rounded ${
            status === "ALL" ? "bg-primary text-white" : "bg-gray-100"
          }`}
        >
          {t("all")}
        </a>
      </div>

      <FlagsTable locale={locale} flags={flags} />
    </div>
  );
}