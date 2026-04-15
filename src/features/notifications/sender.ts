import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

type NotificationData = Record<string, unknown>;

/** Maps each NotificationType to Arabic title + message for the DB record. */
function buildContent(
  type: NotificationType,
  data: NotificationData,
): { title: string; message: string } {
  const listingName = String(data.listingName ?? "منشأتك");
  const reason = String(data.reason ?? "لم يُحدد سبب");

  const map: Record<NotificationType, { title: string; message: string }> = {
    VIDEO_PENDING_REVIEW: {
      title: "فيديو جديد بانتظار المراجعة",
      message: `تم رفع فيديو جديد للمنشأة "${listingName}" وهو بانتظار موافقتك.`,
    },
    VIDEO_APPROVED: {
      title: "تمت الموافقة على الفيديو",
      message: `تمت الموافقة على فيديو منشأتك "${listingName}" وأصبح ظاهراً للزوار.`,
    },
    VIDEO_REJECTED: {
      title: "تم رفض الفيديو",
      message: `تم رفض فيديو منشأتك "${listingName}". السبب: ${reason}`,
    },
    LISTING_PUBLISHED: {
      title: "تم نشر منشأتك",
      message: `تمت الموافقة على منشأتك "${listingName}" وأصبحت ظاهرة في الدليل.`,
    },
    LISTING_SUSPENDED: {
      title: "تم تعليق منشأتك",
      message: `تم تعليق منشأتك "${listingName}". السبب: ${reason}`,
    },
    LISTING_RESTORED: {
      title: "تمت استعادة منشأتك",
      message: `تمت استعادة منشأتك "${listingName}" وأصبحت ظاهرة في الدليل مرة أخرى.`,
    },
    EMAIL_VERIFIED: {
      title: "تم التحقق من البريد الإلكتروني",
      message: "تم التحقق من بريدك الإلكتروني بنجاح. يمكنك الآن إضافة منشأتك.",
    },
    VERIFICATION_GRANTED: {
      title: "تم منح شارة التحقق",
      message: `حصلت منشأتك "${listingName}" على شارة التحقق الرسمي.`,
    },
    VERIFICATION_REVOKED: {
      title: "تم سحب شارة التحقق",
      message: `تم سحب شارة التحقق من منشأتك "${listingName}".`,
    },
    FLAG_SUBMITTED: {
      title: "تم تقديم بلاغ",
      message: `تم تقديم بلاغ جديد بخصوص المنشأة "${listingName}".`,
    },
  };

  return map[type];
}

/**
 * Phase 9 stub — creates the Notification DB record for the in-app center.
 *
 * Phase 9 will add on top of this (no breaking changes to signature):
 *   - Fetch user language preference
 *   - Select bilingual email template
 *   - Dispatch via Resend with retry + Sentry fallback
 *   - Update notification.sentAt on success
 *
 * MUST be called fire-and-forget: never await this in a critical path.
 * A notification failure must never crash a listing action.
 */
export function sendNotification(
  userId: string,
  type: NotificationType,
  data: NotificationData = {},
): void {
  const { title, message } = buildContent(type, data);

  prisma.notification
    .create({
      data: {
        userId,
        type,
        title,
        message,
        isRead: false,
        data: data as never, // Prisma Json field
      },
    })
    .catch((err) => {
      // Never propagate — notification failure is non-fatal
      console.error("[Notification] Failed to create DB record:", err);
    });
}
