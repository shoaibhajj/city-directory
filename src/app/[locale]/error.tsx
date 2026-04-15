"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Classify error type from message without exposing internals
function classifyError(err: Error): { title: string; description: string } {
  const msg = err.message ?? "";

  if (msg.includes("UNAUTHORIZED") || msg.includes("غير مصرح"))
    return {
      title: "غير مصرح",
      description: "يجب تسجيل الدخول للوصول إلى هذه الصفحة.",
    };

  if (msg.includes("FORBIDDEN"))
    return {
      title: "غير مسموح",
      description: "ليس لديك صلاحية للوصول إلى هذه الصفحة.",
    };

  if (msg.includes("NOT_FOUND") || msg.includes("NEXT_NOT_FOUND"))
    return {
      title: "غير موجود",
      description: "الصفحة أو السجل المطلوب غير موجود.",
    };

  if (msg.includes("RATE_LIMIT"))
    return {
      title: "طلبات كثيرة",
      description: "لقد تجاوزت الحد المسموح. يرجى الانتظار قليلاً.",
    };

  // Prisma/DB errors — never show raw message
  if (msg.includes("Prisma") || msg.includes("P2") || msg.includes("column"))
    return {
      title: "خطأ في تحميل البيانات",
      description: "تعذّر تحميل البيانات. يرجى المحاولة مرة أخرى.",
    };

  return {
    title: "حدث خطأ غير متوقع",
    description:
      "يرجى المحاولة مرة أخرى أو التواصل مع الدعم إذا استمرت المشكلة.",
  };
}

export default function RouteError({ error, reset }: ErrorProps) {
  const router = useRouter();
  const { title, description } = classifyError(error);

  useEffect(() => {
    // In production this would be: Sentry.captureException(error)
    console.error("[RouteError]", error);
  }, [error]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center p-8"
      dir="rtl"
    >
      <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
      </div>

      <div className="space-y-2 max-w-sm">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex gap-3">
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/ar")}
          className="gap-2"
        >
          <Home className="w-4 h-4" />
          الرئيسية
        </Button>
      </div>

      {/* Digest: safe to show — it's an opaque ID, not the raw error */}
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          رمز الخطأ: {error.digest}
        </p>
      )}
    </div>
  );
}
