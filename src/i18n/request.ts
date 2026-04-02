// src/i18n/request.ts
// Location: src/i18n/request.ts
//
// This file is called on EVERY server-side request that needs translations.
// It determines which locale is active and loads the right message file.

import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale comes from the URL: /ar/... → 'ar', /en/... → 'en'
  const requested = await requestLocale;

  // hasLocale validates against our supported locales
  // If URL has an unsupported locale (e.g., /fr/...), fall back to default
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // Dynamically import the translation file for this locale
    // WHY dynamic import? We don't want to ship both AR and EN translations
    // to every user. Each user only loads the messages for their language.
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
