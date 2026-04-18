"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { revalidatePath } from "next/cache";
import { redirect as _redirect } from "@/i18n/navigation";
import type { Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { sendNotification } from "@/features/notifications/sender";

const ADMIN_METRICS_KEY = "admin:metrics";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    throw new Error("Unauthorized: Admin access required");
  }
  return session;
}

async function invalidateCache() {
  await redis.del(ADMIN_METRICS_KEY);
}

// ─────────────────────────────────────────────────────────────
// Listing Actions
// ─────────────────────────────────────────────────────────────

export async function suspendListingAction(listingId: string, reason: string) {
  const session = await requireAdmin();

  // Get listing info for notification
  const listing = await prisma.businessProfile.findUnique({
    where: { id: listingId },
    select: { nameAr: true, ownerId: true, categoryId: true },
  });

  // Update listing status
  await prisma.businessProfile.update({
    where: { id: listingId },
    data: { status: "SUSPENDED" },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    actorRole: session.user.role as Role,
    action: "LISTING_SUSPENDED",
    entityType: "BusinessProfile",
    entityId: listingId,
    newValues: { status: "SUSPENDED", reason },
  });

  // Send notification (fire-and-forget)
  if (listing?.ownerId) {
    sendNotification(listing.ownerId, "LISTING_SUSPENDED", {
      listingName: listing.nameAr,
      reason,
      listingId,
    }).catch(console.error);
  }

  await invalidateCache();
  revalidatePath("/[locale]/admin/listings");
}

export async function restoreListingAction(listingId: string) {
  const session = await requireAdmin();

  // Get listing info for notification
  const listing = await prisma.businessProfile.findUnique({
    where: { id: listingId },
    select: { nameAr: true, ownerId: true, categoryId: true },
  });

  // Restore listing status
  await prisma.businessProfile.update({
    where: { id: listingId },
    data: { status: "ACTIVE" },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    actorRole: session.user.role as Role,
    action: "LISTING_RESTORED",
    entityType: "BusinessProfile",
    entityId: listingId,
    newValues: { status: "ACTIVE" },
  });

  // Send notification (fire-and-forget)
  if (listing?.ownerId) {
    sendNotification(listing.ownerId, "LISTING_RESTORED", {
      listingName: listing.nameAr,
      listingId,
    }).catch(console.error);
  }

  await invalidateCache();
  revalidatePath("/[locale]/admin/listings");
}

export async function grantVerificationAction(listingId: string) {
  const session = await requireAdmin();

  // Get listing info for notification
  const listing = await prisma.businessProfile.findUnique({
    where: { id: listingId },
    select: { nameAr: true, ownerId: true, categoryId: true },
  });

  // Grant verification
  await prisma.businessProfile.update({
    where: { id: listingId },
    data: { verifiedAt: new Date(), verifiedById: session.user.id },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    actorRole: session.user.role as Role,
    action: "VERIFICATION_GRANTED",
    entityType: "BusinessProfile",
    entityId: listingId,
  });

  // Send notification (fire-and-forget)
  if (listing?.ownerId) {
    sendNotification(listing.ownerId, "VERIFICATION_GRANTED", {
      listingName: listing.nameAr,
      listingId,
    }).catch(console.error);
  }

  revalidatePath("/[locale]/admin/listings");
}

export async function revokeVerificationAction(listingId: string) {
  const session = await requireAdmin();

  // Get listing info for notification
  const listing = await prisma.businessProfile.findUnique({
    where: { id: listingId },
    select: { nameAr: true, ownerId: true, categoryId: true },
  });

  await prisma.businessProfile.update({
    where: { id: listingId },
    data: { verifiedAt: null, verifiedById: null },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    actorRole: session.user.role as Role,
    action: "VERIFICATION_REVOKED",
    entityType: "BusinessProfile",
    entityId: listingId,
  });

  // Send notification (fire-and-forget)
  if (listing?.ownerId) {
    sendNotification(listing.ownerId, "VERIFICATION_REVOKED", {
      listingName: listing.nameAr,
      listingId,
    }).catch(console.error);
  }

  revalidatePath("/[locale]/admin/listings");
}

export async function bulkSuspendAction(listingIds: string[], reason: string) {
  const session = await requireAdmin();

  await prisma.businessProfile.updateMany({
    where: { id: { in: listingIds } },
    data: { status: "SUSPENDED" },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    actorRole: session.user.role as Role,
    action: "LISTING_SUSPENDED",
    entityType: "BusinessProfile",
    entityId: listingIds.join(","),
    newValues: { count: listingIds.length, reason },
  });

  await invalidateCache();
  revalidatePath("/[locale]/admin/listings");
}

// ─────────────────────────────────────────────────────────────
// User Actions
// ─────────────────────────────────────────────────────────────

export async function banUserAction(userId: string, reason: string) {
  const session = await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: {
      bannedAt: new Date(),
      bannedReason: reason,
    },
  });

  // Delete all sessions for banned user
  await prisma.session.deleteMany({
    where: { userId },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    actorRole: session.user.role as Role,
    action: "USER_BANNED",
    entityType: "User",
    entityId: userId,
    newValues: { reason },
  });

  revalidatePath("/[locale]/admin/users");
}

export async function unbanUserAction(userId: string) {
  const session = await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: {
      bannedAt: null,
      bannedReason: null,
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    actorRole: session.user.role as Role,
    action: "USER_RESTORED",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath("/[locale]/admin/users");
}

export async function changeUserRoleAction(userId: string, newRole: Role) {
  const session = await requireAdmin();

  // Only SUPER_ADMIN can change roles
  if (session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized: Only SUPER_ADMIN can change roles");
  }

  const oldUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    actorRole: session.user.role as Role,
    action: "USER_ROLE_CHANGED",
    entityType: "User",
    entityId: userId,
    previousValues: { role: oldUser?.role },
    newValues: { role: newRole },
  });

  revalidatePath("/[locale]/admin/users");
}

// ─────────────────────────────────────────────────────────────
// Flag Actions
// ─────────────────────────────────────────────────────────────

export async function resolveFlagAction(
  flagId: string,
  resolution: string,
  actionTaken: string
) {
  const session = await requireAdmin();

  await prisma.reviewFlag.update({
    where: { id: flagId },
    data: {
      status: "RESOLVED",
      resolvedById: session.user.id,
      resolvedAt: new Date(),
      resolutionNotes: resolution,
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    actorRole: session.user.role as Role,
    action: "FLAG_RESOLVED",
    entityType: "ReviewFlag",
    entityId: flagId,
    newValues: { resolution, actionTaken },
  });

  await invalidateCache();
  revalidatePath("/[locale]/admin/flags");
}

// ─────────────────────────────────────────────────────────────
// Settings Actions
// ─────────────────────────────────────────────────────────────

export async function saveSettingsAction(updates: Record<string, string>) {
  "use server";
  const session = await requireAdmin();

  // Only SUPER_ADMIN
  if (session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  // Update all settings
  for (const [key, value] of Object.entries(updates)) {
    await prisma.platformSetting.upsert({
      where: { key },
      update: { value, updatedById: session.user.id },
      create: { key, value, updatedById: session.user.id },
    });
  }

  // Invalidate cache
  await redis.del("platform:settings:*");

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    actorRole: session.user.role as Role,
    action: "SETTING_UPDATED",
    entityType: "PlatformSetting",
    entityId: "bulk",
    newValues: { keys: Object.keys(updates) },
  });

  revalidatePath("/[locale]/admin/settings");
}