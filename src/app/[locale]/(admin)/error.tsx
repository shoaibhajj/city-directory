"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Admin errors are always logged — admins need to know
    console.error("[AdminError]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div
      className="p-8 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 max-w-lg mx-auto mt-8"
      dir="rtl"
    >
      <h2 className="font-semibold text-red-800 dark:text-red-300 mb-2">
        خطأ في لوحة الإدارة
      </h2>
      <p className="text-sm text-red-700 dark:text-red-400 mb-4">
        حدث خطأ أثناء تحميل هذه الصفحة. تم تسجيل الخطأ.
      </p>

      {/* Show more detail to admins — they can handle it */}
      {process.env.NODE_ENV === "development" && (
        <pre className="text-xs bg-red-100 dark:bg-red-900/30 p-3 rounded mb-4 overflow-auto max-h-40 text-right">
          {error.message}
        </pre>
      )}

      {error.digest && (
        <p className="text-xs text-red-600 dark:text-red-500 mb-3 font-mono">
          Digest: {error.digest}
        </p>
      )}

      <Button size="sm" variant="destructive" onClick={reset}>
        إعادة المحاولة
      </Button>
    </div>
  );
}
