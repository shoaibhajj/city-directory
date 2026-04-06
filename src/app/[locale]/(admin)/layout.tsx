// src/app/[locale]/(admin)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation"; // ← back to next/navigation, NOT i18n
import { ReactNode } from "react";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect(`/${locale}/sign-in`); // ← plain string, no "as any" needed
  }

  return <>{children}</>;
}
