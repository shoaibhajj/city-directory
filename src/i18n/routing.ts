// src/i18n/routing.ts
// Location: src/i18n/routing.ts
//
// This file is the SINGLE SOURCE OF TRUTH for locale configuration.
// Both the middleware AND the request config import from here.
// WHY one file? If you add a new locale, you change it in ONE place
// and both middleware routing and message loading update automatically.

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // 'always' = every URL has /ar/ or /en/ prefix
  // WHY? Explicit locale in URL = better SEO, no ambiguity
  localePrefix: "always",
});
