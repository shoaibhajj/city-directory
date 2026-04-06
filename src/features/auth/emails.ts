// src/features/auth/emails.ts
import { Resend } from "resend";
import { env } from "@/env";

const resend = new Resend(env.RESEND_API_KEY);

const APP_URL = env.NEXT_PUBLIC_APP_URL;
const FROM = env.RESEND_FROM_EMAIL;

export async function sendVerificationEmail(
  to: string,
  name: string,
  rawToken: string,
): Promise<void> {
  const link = `${APP_URL}/ar/verify-email?token=${rawToken}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "تحقق من بريدك الإلكتروني — دليل النبك",
    html: `
      <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>مرحباً ${name}،</h2>
        <p>شكراً لتسجيلك في دليل النبك. اضغط على الزر أدناه لتفعيل حسابك.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#01696f;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
          تحقق من البريد الإلكتروني
        </a>
        <p style="color:#888;font-size:13px;margin-top:24px;">
          هذا الرابط صالح لمدة 24 ساعة. إذا لم تطلب هذا، تجاهل الرسالة.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  const link = `${APP_URL}/ar/reset-password?token=${rawToken}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "إعادة تعيين كلمة المرور — دليل النبك",
    html: `
      <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>إعادة تعيين كلمة المرور</h2>
        <p>تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك. اضغط على الزر أدناه للمتابعة.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#01696f;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
          إعادة تعيين كلمة المرور
        </a>
        <p style="color:#888;font-size:13px;margin-top:24px;">
          هذا الرابط صالح لساعة واحدة فقط. إذا لم تطلب هذا، تجاهل الرسالة.
        </p>
      </div>
    `,
  });
}
