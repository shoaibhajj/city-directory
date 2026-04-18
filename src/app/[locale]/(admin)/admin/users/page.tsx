import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { UsersTable } from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  const { q = "", page = "1" } = await searchParams;

  const t = await getTranslations("admin.users");
  const pageNum = parseInt(page);
  const pageSize = 20;
  const skip = (pageNum - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = { deletedAt: null };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
    ];
  }

  // Fetch users
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        bannedAt: true,
        createdAt: true,
        _count: { select: { ownedListings: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Search */}
      <form className="flex gap-4">
        <input
          type="text"
          name="q"
          placeholder={t("searchPlaceholder")}
          defaultValue={q}
          className="flex-1 p-2 border rounded"
        />
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded">
          {t("search")}
        </button>
      </form>

      {/* Table */}
      <UsersTable locale={locale} users={users} totalPages={totalPages} currentPage={pageNum} />
    </div>
  );
}