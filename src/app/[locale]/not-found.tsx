import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center p-8"
      dir="rtl"
    >
      <p className="text-8xl font-bold text-muted-foreground/20 select-none">
        ٤٠٤
      </p>

      <div className="space-y-2 max-w-sm -mt-4">
        <h1 className="text-2xl font-semibold">الصفحة غير موجودة</h1>
        <p className="text-muted-foreground text-sm">
          الرابط الذي أدخلته غير صحيح أو تم حذف هذه الصفحة.
        </p>
      </div>

      <div className="flex gap-3">
        <Button asChild>
          <Link href="/ar">العودة للرئيسية</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/ar/dashboard">لوحة التحكم</Link>
        </Button>
      </div>
    </div>
  );
}
