import { Role } from "@prisma/client";

/**
 * Reusable role check helpers.
 * Accept string | null | undefined so they work on session.user.role
 * without requiring a cast on every call site.
 *
 * WHY not inline [Role.ADMIN, Role.SUPER_ADMIN].includes()?
 * TypeScript infers that array as ("ADMIN" | "SUPER_ADMIN")[] — a narrow type.
 * .includes() on a narrow array won't accept a wider Role enum value.
 * The helpers below avoid that trap entirely.
 */

export function isAdmin(role: string | null | undefined): boolean {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === Role.SUPER_ADMIN;
}

export function isOwnerOrAdmin(
  ownerId: string,
  sessionUserId: string,
  sessionRole: string | null | undefined,
): boolean {
  return ownerId === sessionUserId || isAdmin(sessionRole);
}
