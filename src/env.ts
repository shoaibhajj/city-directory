// src/env.ts
// Location: src/env.ts
//
// This file validates ALL environment variables when the application starts.
// If any required variable is missing or malformed, the process crashes
// with a clear, human-readable error message.
//
// PATTERN: "Fail Fast"
// A system that fails immediately on misconfiguration is easier to debug
// than one that silently produces wrong results hours later.
//
// HOW TO USE IN OTHER FILES:
// import { env } from "@/env"
// env.DATABASE_URL   ← TypeScript knows this is a string (not undefined)
// env.RESEND_API_KEY ← TypeScript knows this is a string (not undefined)

import { z } from "zod";

// Define the expected shape and types of all environment variables
const envSchema = z.object({
  // ── Node Environment ──────────────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // ── Database ──────────────────────────────────────────────────────
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid PostgreSQL connection URL"),

  DIRECT_DATABASE_URL: z
    .string()
    .url("DIRECT_DATABASE_URL must be a valid PostgreSQL connection URL"),

  // ── Authentication ────────────────────────────────────────────────
  AUTH_SECRET: z
    .string()
    .min(
      32,
      "AUTH_SECRET must be at least 32 characters. Generate with: openssl rand -base64 32",
    ),

  AUTH_URL: z.string().url("AUTH_URL must be a valid URL"),

  // ── Google OAuth ──────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),

  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),

  // ── Redis (Upstash) ───────────────────────────────────────────────
  UPSTASH_REDIS_REST_URL: z
    .string()
    .url("UPSTASH_REDIS_REST_URL must be a valid URL"),

  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .min(1, "UPSTASH_REDIS_REST_TOKEN is required"),

  // ── Cloudinary ────────────────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // ── Email ──────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z
    .string()
    .email("RESEND_FROM_EMAIL must be a valid email address"),

  // ── Sentry (optional) ─────────────────────────────────────────────
  // .optional() means it can be undefined (empty string is still invalid for a URL)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal("")),

  // ── PostHog (optional) ────────────────────────────────────────────
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://app.posthog.com"),

  // ── Application URL ───────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL"),
});

// Parse and validate process.env
// .safeParse() returns { success: true, data } or { success: false, error }
// instead of throwing immediately (gives us a better error message)
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Format the Zod errors into a readable list
  const issues = parsed.error.issues.map(
    (issue) => `  ✗ ${issue.path.join(".")}: ${issue.message}`,
  );

  // This message appears in your terminal when a variable is wrong/missing
  console.error(
    "\n❌ Invalid environment variables:\n" +
      issues.join("\n") +
      "\n\nCheck your .env.local file against .env.example\n",
  );

  // Exit the process — don't let the app start in a broken state
  process.exit(1);
}

// Export the validated, typed env object
// TypeScript now knows the exact type of each variable
export const env = parsed.data;
