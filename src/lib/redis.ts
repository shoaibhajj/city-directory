// src/lib/redis.ts
// Location: src/lib/redis.ts
//
// Upstash Redis is a serverless Redis service.
//
// WHY Upstash over a traditional Redis server?
// Traditional Redis: requires a persistent TCP connection.
// Serverless functions (Vercel) cannot maintain persistent connections
// because each function invocation is stateless and short-lived.
// Upstash uses HTTP requests instead of TCP — perfectly compatible with serverless.
//
// The @upstash/redis client abstracts the HTTP complexity.
// You use it exactly like traditional Redis: get, set, del, incr, etc.
//
// LOCAL DEVELOPMENT NOTE:
// For local dev, you need an Upstash account (free tier: 10,000 commands/day).
// Alternatively, you can use ioredis pointed at your Docker Redis for local dev,
// but this adds complexity. For simplicity, we use Upstash for both environments.
// Sign up at: console.upstash.com

import { Redis } from "@upstash/redis";
import { env } from "@/env";

// The Redis.fromEnv() factory reads UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN from environment variables automatically
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// ─────────────────────────────────────────────────────────────────────
// CACHE KEY CONSTANTS
//
// WHY define cache keys as constants here?
// Imagine you have "categories:all" as a cache key written as a raw string
// in 5 different files. One day you rename it to "cats:all".
// You search-and-replace — but miss one occurrence.
// Now that one file reads from an old key that never gets updated.
// Silent bug: that one file always returns stale data.
//
// With constants, you change one string and every file using it is updated.
// TypeScript would also catch any typos in constant names.
// ─────────────────────────────────────────────────────────────────────
export const CACHE_KEYS = {
  CATEGORIES_ALL: "categories:all",
  SETTING: (key: string) => `setting:${key}`,
  SEARCH_SUGGEST: (query: string) => `suggest:${encodeURIComponent(query)}`,
  PDF: (city: string, category: string, lang: string) =>
    `pdf:${city}:${category}:${lang}`,
} as const;

// ─────────────────────────────────────────────────────────────────────
// CACHE TTL CONSTANTS (in seconds)
//
// TTL = Time To Live: how long a cached item stays valid before expiring
// Choosing the right TTL is a tradeoff:
// - Too short: cache misses too often, DB gets hammered
// - Too long: users see stale data
// ─────────────────────────────────────────────────────────────────────
export const CACHE_TTL = {
  CATEGORIES: 60 * 10, // 10 minutes — categories change rarely
  SETTING: 60 * 5, // 5 minutes — settings change rarely
  SEARCH_SUGGEST: 60, // 1 minute — search terms change constantly
  PDF_CATEGORY: 60 * 60 * 6, // 6 hours — regenerate if listing changes
  PDF_FULL: 60 * 60 * 24, // 24 hours — full directory changes rarely
} as const;
