// src/app/[locale]/(dashboard)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
// ← removed: import { cookies } from "next/headers"

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  // ← removed: console.log("[DASHBOARD LAYOUT] session:", ...)
  // ← removed: const cookieStore = await cookies()
  // ← removed: console.log("[COOKIES]", ...)

  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  if (!session.user.emailVerified) {
    redirect(`/${locale}/verify-email`);
  }

  return <>{children}</>;
}
