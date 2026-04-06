// src/app/[locale]/(auth)/verify-email/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useSearchParams, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { verifyEmailAction } from "@/features/auth/actions";

export default function VerifyEmailPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { locale } = useParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  // If the user's email is already verified (Google users), redirect to dashboard
  useEffect(() => {
    if (session?.user?.emailVerified) {
      window.location.href = `/${locale}/dashboard`;
    }
  }, [session, locale]);

  // If a token is in the URL, verify it automatically
  useEffect(() => {
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("loading");
    verifyEmailAction(token).then((result) => {
      if (result.success) {
        setStatus("success");
        setMessage("تم التحقق من بريدك الإلكتروني بنجاح!");
        setTimeout(() => {
          window.location.href = `/${locale}/dashboard`;
        }, 2000);
      } else {
        setStatus("error");
        setMessage(result.error);
      }
    });
  }, [token, locale]);

  // No token in URL = user arrived here without clicking the email link
  if (!token) {
    return (
      <div dir="rtl" className="text-center space-y-4">
        <div className="text-4xl">📧</div>
        <h2 className="text-xl font-semibold text-gray-900">
          تحقق من بريدك الإلكتروني
        </h2>
        <p className="text-gray-600 text-sm">
          أرسلنا رابط التحقق إلى بريدك الإلكتروني.
          <br />
          اضغط على الرابط في الرسالة لتفعيل حسابك.
        </p>
        <p className="text-gray-400 text-xs">
          إذا لم تجد الرسالة، تحقق من مجلد البريد غير المرغوب فيه.
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="text-center space-y-4">
      {status === "loading" && <p className="text-gray-600">جاري التحقق...</p>}
      {status === "success" && (
        <>
          <div className="text-4xl">✅</div>
          <p className="text-green-600 font-medium">{message}</p>
          <p className="text-gray-400 text-sm">
            سيتم تحويلك إلى لوحة التحكم...
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <div className="text-4xl">❌</div>
          <p className="text-red-600">{message}</p>
        </>
      )}
    </div>
  );
}
