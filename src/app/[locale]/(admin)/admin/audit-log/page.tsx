import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ entityType?: string; action?: string; page?: string }>;
}) {
  const { locale: _locale } = await params;
  const { entityType = "", action = "", page = "1" } = await searchParams;

  const t = await getTranslations("admin.auditLog");
  const pageNum = parseInt(page);
  const pageSize = 50;
  const skip = (pageNum - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (action) where.action = action;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Filters */}
      <form className="flex gap-4">
        <select
          name="entityType"
          defaultValue={entityType}
          className="p-2 border rounded"
        >
          <option value="">{t("allEntities")}</option>
          <option value="User">User</option>
          <option value="BusinessProfile">Listing</option>
          <option value="ReviewFlag">Flag</option>
          <option value="MediaFile">Media</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded">
          {t("filter")}
        </button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3">{t("timestamp")}</th>
              <th className="text-left p-3">{t("actor")}</th>
              <th className="text-left p-3">{t("action")}</th>
              <th className="text-left p-3">{t("entity")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b hover:bg-muted/50">
                <td className="p-3 text-sm">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="p-3 text-sm">{log.actorEmail || "System"}</td>
                <td className="p-3">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                    {log.action}
                  </span>
                </td>
                <td className="p-3 text-sm">
                  {log.entityType}:{log.entityId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <a
              key={i}
              href={`admin/audit-log?page=${i + 1}`}
              className={`px-3 py-1 rounded ${
                pageNum === i + 1 ? "bg-primary text-white" : "bg-gray-100"
              }`}
            >
              {i + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}