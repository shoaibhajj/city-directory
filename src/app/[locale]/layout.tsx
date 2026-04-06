// src/app/[locale]/layout.tsx
// Location: src/app/[locale]/layout.tsx
//
// ROOT LAYOUT FOR ALL LOCALIZED PAGES
// Every page under /ar/... and /en/... renders inside this layout.
//
// KEY CONCEPT — RTL vs LTR:
// Arabic reads right-to-left. English reads left-to-right.
// The HTML 'dir' attribute tells the browser AND CSS which direction to render:
//   dir="rtl" → layout mirrors: sidebar on right, text aligns right,
//               padding-inline-start becomes padding-inline-end
//   dir="ltr" → standard western layout
//
// By setting dir dynamically, the ENTIRE PAGE mirrors automatically
// when switching Arabic ↔ English. This is the correct approach.
// CSS hacks like "text-align: right" everywhere are WRONG — they break
// when you add a third language and miss dozens of edge cases.
//
// ABOUT FONTS:
// Cairo is a Google Font designed for Arabic AND Latin characters.
// WHY Cairo for both languages? Consistency — both languages share the same
// visual weight and style. In Phase 10 (SEO & Performance), we may add a
// dedicated Latin font for English if needed.

import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Cairo } from "next/font/google";
import { routing } from "@/i18n/routing";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";

// ─── Font Setup ───────────────────────────────────────────────────────
// next/font automatically:
// - Downloads the font at build time (no runtime network request)
// - Generates a unique CSS class name (prevents style conflicts)
// - Sets font-display: swap (text shows immediately in fallback font)
// - Subsets to only the characters we need (smaller file size)
const cairo = Cairo({
  subsets: ["arabic", "latin"], // Load both Arabic AND Latin character sets
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-cairo", // CSS variable we can reference in Tailwind
  display: "swap",
});

// ─── Props ────────────────────────────────────────────────────────────
interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>; // Async in Next.js 15+
}

// ─── Metadata ─────────────────────────────────────────────────────────
// generateMetadata can be made dynamic per locale in the future.
// For now, Arabic default metadata.
export const metadata: Metadata = {
  title: {
    // %s is replaced by each page's own title
    // Example: "الصيدليات | دليل النبك"
    template: "%s | دليل النبك",
    default: "دليل النبك",
  },
  description: "دليل أعمال مدينة النبك الإلكتروني",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
};

// ─── Layout Component ─────────────────────────────────────────────────
export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  // Await params — required in Next.js 15+ (params became async)
  const { locale } = await params;
  const session = await auth(); // pass session to client so no extra fetch

  // Validate locale — if someone visits /fr/... they get a 404
  // hasLocale checks against routing.locales = ['ar', 'en']
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Load translation messages for this locale (server-side only)
  // These are passed to NextIntlClientProvider below
  const messages = await getMessages();

  // Set text direction based on locale
  // Add new RTL languages here when expanding
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={direction}
      // cairo.variable makes --font-cairo available in CSS
      // The actual font class applies Cairo to the html element
      className={`${cairo.variable} ${cairo.className}`}
    >
      <body>
        {/*
          NextIntlClientProvider makes translations available to
          CLIENT COMPONENTS. Server components use getTranslations() directly.

          WHY pass messages here? The provider needs the messages object
          to serve translation strings to client components.
          Without this, useTranslations() in client components returns nothing.
        */}
        <NextIntlClientProvider messages={messages} locale={locale}>
          <SessionProvider session={session} basePath="/api/v1/auth">
            {children}
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
