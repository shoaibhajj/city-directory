// src/app/[locale]/page.tsx
// Location: src/app/[locale]/page.tsx
//
// This is the HOME PAGE for all locales:
//   Arabic:  /ar/
//   English: /en/
//
// useTranslations is a Server Component hook from next-intl
// It reads from your messages/ar.json or messages/en.json

import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("common");

  return (
    <main style={{ padding: "2rem" }}>
      <h1>{t("appName")}</h1>
      <p>Phase 0 Complete ✅</p>
    </main>
  );
}
