import { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("common");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header strip */}
          <div className="bg-teal-600 px-8 py-6 text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {t("appName")}
            </h1>
            <p className="text-teal-100 text-sm mt-1">{t("appTagline")}</p>
          </div>
          {/* Content */}
          <div className="px-8 py-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
