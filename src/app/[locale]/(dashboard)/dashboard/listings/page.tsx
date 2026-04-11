// src/app/[locale]/(dashboard)/dashboard/listings/page.tsx

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getListingsByOwner } from "@/features/business/queries";
import { softDeleteListingAction } from "@/features/business/actions";
import { Link } from "@/i18n/navigation";
import { ListingStatusBadge } from "@/features/business/listing-status-badge";

export default async function DashboardListingsPage({}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/ar/sign-in");
  }

  const listings = await getListingsByOwner(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My listings</h1>
          <p className="text-muted-foreground">
            Create, edit, preview, and delete your business listings.
          </p>
        </div>

        <Link
          href={`/dashboard/listings/new`}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
        >
          New listing
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-start">Name</th>
              <th className="px-4 py-3 text-start">Category</th>
              <th className="px-4 py-3 text-start">Status</th>
              <th className="px-4 py-3 text-start">Views</th>
              <th className="px-4 py-3 text-start">Published</th>
              <th className="px-4 py-3 text-start">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr key={listing.id} className="border-t">
                <td className="px-4 py-3">{listing.nameAr}</td>
                <td className="px-4 py-3">{listing.category.nameAr}</td>
                <td className="px-4 py-3">
                  <ListingStatusBadge status={listing.status} />
                </td>
                <td className="px-4 py-3">{listing.viewCount}</td>
                <td className="px-4 py-3">
                  {listing.publishedAt
                    ? listing.publishedAt.toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/listings/${listing.id}`}
                      className="rounded border px-3 py-1.5"
                    >
                      Edit
                    </Link>

                    {listing.slug ? (
                      <Link
                        href={`/${listing.city.slug}/${listing.category.slug}/${listing.slug}`}
                        className="rounded border px-3 py-1.5"
                        target="_blank"
                      >
                        Preview
                      </Link>
                    ) : null}

                    <form
                      action={async () => {
                        "use server";
                        await softDeleteListingAction(listing.id);
                      }}
                    >
                      <button className="rounded border px-3 py-1.5 text-red-600">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}

            {listings.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No listings yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
