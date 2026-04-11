// src/app/[locale]/(dashboard)/dashboard/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getListingsByOwner } from "@/features/business/queries";
import { OwnerDashboardStats } from "@/features/business/owner-dashboard-stats";

export default async function DashboardHomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/ar/sign-in");
  }

  const listings = await getListingsByOwner(session.user.id);

  const total = listings.length;
  const draft = listings.filter((item) => item.status === "DRAFT").length;
  const active = listings.filter((item) => item.status === "ACTIVE").length;
  const suspended = listings.filter(
    (item) => item.status === "SUSPENDED",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your listings and recent activity.
        </p>
      </div>

      <OwnerDashboardStats
        total={total}
        draft={draft}
        active={active}
        suspended={suspended}
      />

      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-lg font-medium">Recent notifications</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Notification center will be expanded in Phase 9.
        </p>
      </div>
    </div>
  );
}
