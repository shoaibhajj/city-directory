// src/features/platform/settings.ts
//
// WHY cache PlatformSetting in Redis?
// This table is read on almost EVERY request:
//   - Listing creation checks max_listings_per_owner
//   - Upload handler checks max_photos and max_video_size_mb
//   - PDF generation reads pdf_cache_ttl_seconds
//   - Rate limiter reads listing_rate_limit_per_day
//
// Without caching, every request hits the DB for a handful of static values.
// With a 5-minute Redis cache (TTL=300), the DB load drops to near-zero.
//
// Cache invalidation: admin/settings/page.tsx calls invalidateAllSettings()
// after any update — the next read re-populates from DB automatically.

import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const CACHE_TTL = 300; // 5 minutes in seconds

// ── Key constants ─────────────────────────────────────────────────────────────
// Centralize all setting keys to prevent typos scattered across the codebase.
// Usage: getSetting(SETTING_KEYS.MAX_PHOTOS)
export const SETTING_KEYS = {
  MAX_PHOTOS: "max_photos",
  MAX_VIDEOS: "max_videos",
  MAX_LISTINGS_PER_OWNER: "max_listings_per_owner",
  MAX_VIDEO_SIZE_MB: "max_video_size_mb",
  MAX_VIDEO_DURATION_SECONDS: "max_video_duration_seconds",
  PDF_CACHE_TTL_SECONDS: "pdf_cache_ttl_seconds",
  LISTING_RATE_LIMIT_PER_DAY: "listing_rate_limit_per_day",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

// ── Core read functions ───────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const cacheKey = `setting:${key}`;

  const cached = await redis.get(cacheKey);
  // Upstash auto-deserializes JSON — "10" comes back as number 10
  // Always coerce to string so callers get consistent types
  if (cached !== null && cached !== undefined) return String(cached);

  const setting = await prisma.platformSetting.findUnique({ where: { key } });
  if (!setting) return null;

  await redis.setex(cacheKey, CACHE_TTL, setting.value);
  return setting.value;
}

export async function getSettingNumber(
  key: string,
  fallback: number,
): Promise<number> {
  const value = await getSetting(key);
  if (value === null) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

export async function getSettingBoolean(
  key: string,
  fallback: boolean,
): Promise<boolean> {
  const value = await getSetting(key);
  if (value === null) return fallback;
  return value === "true" || value === "1";
}

// ── Cache invalidation ────────────────────────────────────────────────────────
// Call from admin settings page after any update.

export async function invalidateSetting(key: string): Promise<void> {
  await redis.del(`setting:${key}`);
}

export async function invalidateAllSettings(): Promise<void> {
  // Invalidate all known setting keys
  const pipeline = redis.pipeline();
  for (const key of Object.values(SETTING_KEYS)) {
    pipeline.del(`setting:${key}`);
  }
  await pipeline.exec();
}

// ── Convenience getters for the most-used settings ───────────────────────────
// These are called frequently enough to deserve typed, named functions.

export const getMaxPhotos = () => getSettingNumber(SETTING_KEYS.MAX_PHOTOS, 10);
export const getMaxVideos = () => getSettingNumber(SETTING_KEYS.MAX_VIDEOS, 3);
export const getMaxListingsPerOwner = () =>
  getSettingNumber(SETTING_KEYS.MAX_LISTINGS_PER_OWNER, 3);
export const getMaxVideoSizeMb = () =>
  getSettingNumber(SETTING_KEYS.MAX_VIDEO_SIZE_MB, 100);
export const getMaxVideoDurationSeconds = () =>
  getSettingNumber(SETTING_KEYS.MAX_VIDEO_DURATION_SECONDS, 300);
export const getPdfCacheTtlSeconds = () =>
  getSettingNumber(SETTING_KEYS.PDF_CACHE_TTL_SECONDS, 21600);
export const getListingRateLimitPerDay = () =>
  getSettingNumber(SETTING_KEYS.LISTING_RATE_LIMIT_PER_DAY, 1);
