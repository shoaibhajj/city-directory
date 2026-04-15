"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowRight } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  const router = useRouter();

  return (
    <div
      className="flex flex-col items-center justify-center py-20 gap-4 text-center"
      dir="rtl"
    >
      <p className="text-4xl">⚠️</p>
      <h2 className="text-lg font-semibold">تعذّر تحميل هذه الصفحة</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        حدث خطأ في لوحة التحكم. بياناتك محفوظة — يرجى إعادة المحاولة.
      </p>
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={reset} className="gap-1">
          <RefreshCw className="w-3.5 h-3.5" />
          إعادة المحاولة
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push("/ar/dashboard")}
          className="gap-1"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          الرئيسية
        </Button>
      </div>
    </div>
  );
}
