// src/app/[locale]/(dashboard)/dashboard/page.tsx
import { auth } from "@/lib/auth";
import { signOutAction } from "@/features/auth/actions";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="min-h-screen p-8" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">لوحة التحكم</h1>
      <div className="bg-white rounded-xl shadow p-6 space-y-2">
        <p>
          <span className="font-medium">الاسم:</span> {session?.user?.name}
        </p>
        <p>
          <span className="font-medium">البريد:</span> {session?.user?.email}
        </p>
        <p>
          <span className="font-medium">الدور:</span> {session?.user?.role}
        </p>
        <p>
          <span className="font-medium">البريد مفعّل:</span>{" "}
          {session?.user?.emailVerified ? "✅ نعم" : "❌ لا"}
        </p>
      </div>
      <form action={signOutAction} className="mt-6">
        <button
          type="submit"
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 text-sm"
        >
          تسجيل الخروج
        </button>
      </form>
    </div>
  );
}
