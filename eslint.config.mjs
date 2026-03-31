// eslint.config.mjs
// Location: root of project
//
// SOURCE: This is based directly on the official Next.js 16 ESLint docs.
// https://nextjs.org/docs/app/api-reference/config/eslint
//
// WHY this is simpler than my previous attempts:
// eslint-config-next 16 was rewritten to natively export flat config objects.
// You just import and spread them — no FlatCompat bridge needed.
// The circular reference error was caused by using FlatCompat unnecessarily.
//
// The three imports cover everything:
//   nextVitals  → Next.js rules + React rules + React Hooks rules
//                 "core-web-vitals" upgrades certain rules from warn → error
//                 which catches real performance problems (missing key props, etc.)
//   nextTs      → TypeScript-specific rules from @typescript-eslint/recommended
//                 (already included in eslint-config-next/typescript)
//   prettier    → Turns OFF all ESLint formatting rules that conflict with Prettier
//                 MUST be last so it overrides everything above it

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  // ── Next.js + React + React Hooks rules ──────────────────────────
  ...nextVitals,

  // ── TypeScript rules ──────────────────────────────────────────────
  ...nextTs,

  // ── Our custom rules ──────────────────────────────────────────────
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Warn when console.log appears — reminder to clean up before shipping
      // console.error and console.warn are legitimate and allowed
      "no-console": ["warn", { allow: ["error", "warn"] }],

      // Error on unused variables — unused code is confusion and potential bugs
      // Prefix with _ to intentionally mark as unused: const _unused = ...
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],

      // Warn on explicit 'any' — it disables TypeScript's type safety
      "@typescript-eslint/no-explicit-any": "warn",

      // Enforce const when variable is never reassigned
      "prefer-const": "error",

      // Allow empty interfaces — common in Next.js page/layout props
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },

  // ── Prettier MUST be last ─────────────────────────────────────────
  // Disables all ESLint rules that would conflict with Prettier formatting.
  // If not last, rules above can re-enable formatting rules causing conflicts.
  prettier,

  // ── Global ignores ────────────────────────────────────────────────
  // These files are never linted regardless of other config
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "prisma/migrations/**",
  ]),
]);
