import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./SettingsForm";
// Platform settings managed in actions.ts

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  // Only SUPER_ADMIN can access
  if (session?.user?.role !== "SUPER_ADMIN") {
    redirect(`${locale}/admin` as any);
  }

  const t = await getTranslations("admin.settings");

  // Fetch all settings
  const settings = await prisma.platformSetting.findMany({
    orderBy: { key: "asc" },
  });

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <SettingsForm locale={locale} settings={settingsMap} keys={settings.map((s) => s.key)} />
    </div>
  );
}