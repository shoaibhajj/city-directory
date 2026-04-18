"use client";

import { Link } from "@/i18n/navigation";
import { useTransition } from "react";
import { banUserAction, unbanUserAction, changeUserRoleAction } from "@/features/admin/actions";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  bannedReason: string | null;
  createdAt: Date;
  _count: { ownedListings: number };
}

interface Props {
  locale: string;
  users: User[];
  totalPages: number;
  currentPage: number;
}

export function UsersTable({ locale, users, totalPages, currentPage }: Props) {
  void locale; // locale available for navigation
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">Email</th>
            <th className="text-left p-3">Role</th>
            <th className="text-left p-3">Listings</th>
            <th className="text-left p-3">Joined</th>
            <th className="text-left p-3">Status</th>
            <th className="text-left p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow key={user.id} locale={locale} user={user} />
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => (
            <Link
              key={i}
              href={`admin/users?page=${i + 1}`}
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

function UserRow({ locale: _locale, user }: { locale: string; user: User }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleBan = () => {
    const reason = prompt("Enter ban reason:");
    if (!reason) return;
    startTransition(async () => {
      await banUserAction(user.id, reason);
      router.refresh();
    });
  };

  const handleUnban = () => {
    startTransition(async () => {
      await unbanUserAction(user.id);
      router.refresh();
    });
  };

  const handleRoleChange = (newRole: Role) => {
    startTransition(async () => {
      await changeUserRoleAction(user.id, newRole);
      router.refresh();
    });
  };

  const roleBadge = (role: Role) => {
    const classes =
      role === "SUPER_ADMIN"
        ? "bg-purple-100 text-purple-800"
        : role === "ADMIN"
        ? "bg-blue-100 text-blue-800"
        : "bg-gray-100 text-gray-800";
    return <span className={`px-2 py-1 rounded text-xs ${classes}`}>{role}</span>;
  };

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="p-3">
        <Link href={`admin/users/${user.id}`} className="font-medium hover:underline">
          {user.name || "—"}
        </Link>
      </td>
      <td className="p-3 text-sm">{user.email}</td>
      <td className="p-3">{roleBadge(user.role)}</td>
      <td className="p-3">{user._count.ownedListings}</td>
      <td className="p-3 text-sm">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="p-3">
        {user.bannedReason ? (
          <span className="text-red-600 text-xs">Banned</span>
        ) : (
          <span className="text-green-600 text-xs">Active</span>
        )}
      </td>
      <td className="p-3">
        <div className="flex gap-2">
          {user.bannedReason ? (
            <button
              onClick={handleUnban}
              disabled={pending}
              className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
            >
              Unban
            </button>
          ) : (
            <button
              onClick={handleBan}
              disabled={pending}
              className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Ban
            </button>
          )}
          <select
            disabled={pending}
            onChange={(e) => handleRoleChange(e.target.value as Role)}
            defaultValue={user.role}
            className="text-xs p-1 border rounded"
          >
            <option value="BUSINESS_OWNER">Business Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </div>
      </td>
    </tr>
  );
}