import { getTranslations } from "next-intl/server";
import { getAdminMetrics } from "@/features/admin/queries";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params; // locale available for future use
  const t = await getTranslations("admin.dashboard");
  const metrics = await getAdminMetrics();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label={t("activeListings")} value={metrics.activeListings} />
        <StatCard label={t("draftListings")} value={metrics.draftListings} />
        <StatCard label={t("suspendedListings")} value={metrics.suspendedListings} />
        <StatCard label={t("newUsers")} value={metrics.newUsersThisWeek} />
        <StatCard label={t("pendingReviews")} value={metrics.pendingReviews} />
        <StatCard label={t("unresolvedFlags")} value={metrics.unresolvedFlags} />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="admin/listings"
          className="p-6 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-lg">{t("manageListings")}</h3>
          <p className="text-sm text-gray-500">{t("manageListingsDesc")}</p>
        </Link>
        <Link
          href="admin/users"
          className="p-6 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-lg">{t("manageUsers")}</h3>
          <p className="text-sm text-gray-500">{t("manageUsersDesc")}</p>
        </Link>
        <Link
          href="admin/flags"
          className="p-6 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-lg">{t("reviewFlags")}</h3>
          <p className="text-sm text-gray-500">{t("reviewFlagsDesc")}</p>
        </Link>
      </div>

      {/* Listings Per Category */}
      <div className="bg-card rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">{t("listingsPerCategory")}</h2>
        <div className="space-y-2">
          {metrics.listingsPerCategory.map((cat) => (
            <div key={cat.categoryId} className="flex justify-between items-center">
              <span>{cat.nameAr}</span>
              <span className="font-medium">{cat.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="bg-card rounded-lg shadow-sm p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}