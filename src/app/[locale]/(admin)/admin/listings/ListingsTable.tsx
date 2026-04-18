"use client";

import { Link } from "@/i18n/navigation";
import { useTransition } from "react";
import {
  suspendListingAction,
  restoreListingAction,
  grantVerificationAction,
  revokeVerificationAction,
} from "@/features/admin/actions";
import { useRouter } from "next/navigation";

interface Listing {
  id: string;
  nameAr: string;
  nameEn: string | null;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  verifiedAt: Date | null;
  category: { nameAr: string; nameEn: string };
  owner: { email: string; name: string | null };
}

interface Props {
  locale: string;
  listings: Listing[];
  totalPages: number;
  currentPage: number;
}

export function ListingsTable({ locale, listings, totalPages, currentPage }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">Category</th>
            <th className="text-left p-3">Owner</th>
            <th className="text-left p-3">Status</th>
            <th className="text-left p-3">Views</th>
            <th className="text-left p-3">Verified</th>
            <th className="text-left p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <ListingRow key={listing.id} locale={locale} listing={listing} />
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => (
            <Link
              key={i}
              href={`admin/listings?page=${i + 1}`}
              className={`px-3 py-1 rounded ${
                currentPage === i + 1 ? "bg-primary text-white" : "bg-gray-100"
              }`}
            >
              {i + 1}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ListingRow({ locale, listing }: { locale: string; listing: Listing }) {
  void locale;
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSuspend = () => {
    const reason = prompt("Enter suspension reason:");
    if (!reason) return;
    startTransition(async () => {
      await suspendListingAction(listing.id, reason);
      router.refresh();
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      await restoreListingAction(listing.id);
      router.refresh();
    });
  };

  const handleVerify = () => {
    startTransition(async () => {
      await grantVerificationAction(listing.id);
      router.refresh();
    });
  };

  const handleRevoke = () => {
    startTransition(async () => {
      await revokeVerificationAction(listing.id);
      router.refresh();
    });
  };

  const statusClass =
    listing.status === "ACTIVE"
      ? "bg-green-100 text-green-800"
      : listing.status === "DRAFT"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800";

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="p-3">
        <Link href={`admin/listings/${listing.id}`} className="font-medium hover:underline">
          {listing.nameAr}
        </Link>
      </td>
      <td className="p-3">{listing.category.nameAr}</td>
      <td className="p-3 text-sm">{listing.owner.email}</td>
      <td className="p-3">
        <span className={`px-2 py-1 rounded text-xs ${statusClass}`}>
          {listing.status}
        </span>
      </td>
      <td className="p-3">{listing.views}</td>
      <td className="p-3">{listing.verifiedAt ? "✓" : "—"}</td>
      <td className="p-3">
        <div className="flex gap-2">
          {listing.status === "ACTIVE" ? (
            <button
              onClick={handleSuspend}
              disabled={pending}
              className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Suspend
            </button>
          ) : (
            <button
              onClick={handleRestore}
              disabled={pending}
              className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
            >
              Restore
            </button>
          )}
          {listing.verifiedAt ? (
            <button
              onClick={handleRevoke}
              disabled={pending}
              className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              Revoke
            </button>
          ) : (
            <button
              onClick={handleVerify}
              disabled={pending}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
            >
              Verify
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}