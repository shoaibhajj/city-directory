// src/app/[locale]/(dashboard)/dashboard/notifications/page.tsx
// User notification center

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Link } from "@/i18n/navigation";
import { MarkAllReadButton } from "./MarkAllReadButton";
import { Prisma } from "@prisma/client";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/sign-in`);
  }

  const t = await getTranslations("notifications");

  // Fetch user's notifications
  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("title") || "الإشعارات"}</h1>
        {unreadCount > 0 && <MarkAllReadButton count={unreadCount} />}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">🔔</div>
          <p>{t("empty") || "لا توجد إشعارات"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={getNotificationLink(notification, locale)}
              className={`block p-4 rounded-lg transition-colors ${
                notification.isRead
                  ? "bg-white dark:bg-gray-900"
                  : "bg-blue-50 dark:bg-blue-900/20 border-r-4 border-blue-500"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">{notification.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatDistanceToNow(notification.createdAt, {
                      addSuffix: true,
                      locale: locale === "ar" ? ar : undefined,
                    })}
                  </p>
                </div>
                {!notification.isRead && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function getNotificationLink(
  notification: { type: string; data: Prisma.JsonValue | null },
  locale: string
): string {
  const data = notification.data as Record<string, unknown> | null;
  
  switch (notification.type) {
    case "LISTING_PUBLISHED":
    case "LISTING_SUSPENDED":
    case "LISTING_RESTORED":
    case "VERIFICATION_GRANTED":
    case "VERIFICATION_REVOKED":
      if (data?.listingId && data.categorySlug) {
        return `/${locale}/al-nabik/${data.categorySlug}/${data.listingSlug || ''}`;
      }
      return `/${locale}/dashboard/listings`;
    case "VIDEO_PENDING_REVIEW":
    case "VIDEO_APPROVED":
    case "VIDEO_REJECTED":
      return `/${locale}/dashboard/listings`;
    default:
      return `/${locale}/dashboard`;
  }
}