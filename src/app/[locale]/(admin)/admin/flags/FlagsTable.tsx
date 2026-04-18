"use client";

import { Link } from "@/i18n/navigation";
import { useTransition } from "react";
import { resolveFlagAction } from "@/features/admin/actions";
import { useRouter } from "next/navigation";

interface Flag {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: Date;
  business: { nameAr: string; nameEn: string | null; slug: string };
  reportedBy: { email: string } | null;
}

interface Props {
  locale: string;
  flags: Flag[];
}

export function FlagsTable({ locale, flags }: Props) {
  void locale;
  if (flags.length === 0) {
    return <p className="text-gray-500">No flags found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-3">Business</th>
            <th className="text-left p-3">Reason</th>
            <th className="text-left p-3">Reporter</th>
            <th className="text-left p-3">Date</th>
            <th className="text-left p-3">Status</th>
            <th className="text-left p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((flag) => (
            <FlagRow key={flag.id} locale={locale} flag={flag} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlagRow({ locale, flag }: { locale: string; flag: Flag }) {
  void locale;
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleResolve = () => {
    const resolution = prompt("Enter resolution notes:");
    if (!resolution) return;
    startTransition(async () => {
      await resolveFlagAction(flag.id, resolution, "Resolved");
      router.refresh();
    });
  };

  const statusBadge = (status: string) => {
    const classes =
      status === "PENDING"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-green-100 text-green-800";
    return <span className={`px-2 py-1 rounded text-xs ${classes}`}>{status}</span>;
  };

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="p-3">
        <Link
          href={`al-nabik/${flag.business.slug}`}
          className="font-medium hover:underline"
        >
          {flag.business.nameAr}
        </Link>
      </td>
      <td className="p-3">{flag.reason}</td>
      <td className="p-3 text-sm">{flag.reportedBy?.email || "—"}</td>
      <td className="p-3 text-sm">
        {new Date(flag.createdAt).toLocaleDateString()}
      </td>
      <td className="p-3">{statusBadge(flag.status)}</td>
      <td className="p-3">
        {flag.status === "PENDING" && (
          <button
            onClick={handleResolve}
            disabled={pending}
            className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
          >
            Resolve
          </button>
        )}
      </td>
    </tr>
  );
}