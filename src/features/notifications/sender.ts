import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

type NotificationData = Record<string, unknown>;

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@city-directory.com";

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
 * Sends a notification to a user - creates in-app notification and optionally sends email.
 * 
 * This is fire-and-forget: never await this in a critical path.
 * A notification failure must never crash a listing action.
 */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  data: NotificationData = {},
): Promise<void> {
  const { title, message } = buildContent(type, data);

  // Create in-app notification
  const notification = await prisma.notification
    .create({
      data: {
        userId,
        type,
        title,
        message,
        isRead: false,
        data: data as never,
      },
    })
    .catch((err) => {
      console.error("[Notification] Failed to create DB record:", err);
      return null;
    });

  if (!notification) return;

  // Send email if Resend is configured
  if (!resend) {
    console.warn("[Notification] RESEND_API_KEY not set, skipping email");
    return undefined;
  }

  // Get user email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user?.email) {
    console.warn("[Notification] User has no email, skipping email send");
    return;
  }

  // Build email subject and content based on type
  const emailSubject = `[دليل المدن] ${title}`;
  const emailHtml = buildEmailHtml(type, data, title, message, user.name);

  // Send email with retry
  await sendEmailWithRetry(user.email, emailSubject, emailHtml);

  // Update sentAt timestamp
  await prisma.notification.update({
    where: { id: notification.id },
    data: { sentAt: new Date() },
  });
}

async function sendEmailWithRetry(
  to: string,
  subject: string,
  html: string,
  retries = 3
): Promise<void> {
  if (!resend) return;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      });
      console.log(`[Notification] Email sent to ${to}`);
      return;
    } catch (error) {
      console.error(`[Notification] Email send attempt ${attempt} failed:`, error);
      if (attempt === retries) {
        console.error(`[Notification] All ${retries} email send attempts failed`);
      } else {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
}

function buildEmailHtml(
  type: NotificationType,
  data: NotificationData,
  title: string,
  message: string,
  userName: string | null
): string {
  const listingUrl = data.listingId 
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/ar/al-nabik/${data.categorySlug || 'general'}/${data.listingSlug || ''}`
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
  const actionButton = type !== 'EMAIL_VERIFIED' ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${listingUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        عرض التفاصيل
      </a>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fa; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">دليل المدن</h1>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
          <p style="color: #4b5563; line-height: 1.6;">${message}</p>
          ${actionButton}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            تم إرسال هذه الرسالة إلى ${userName || 'المستخدم'} لأنك اشتركت في إشعارات دليل المدن.
            <br>
            © ${new Date().getFullYear()} دليل المدن - دليل النبك
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
