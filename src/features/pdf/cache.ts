import { redis } from "@/lib/redis";

const PDF_CACHE_PREFIX = "pdf:";
const PDF_CACHE_TTL = 60 * 60 * 24; // 24 hours

export function getPdfCacheKey(citySlug: string, categorySlug: string, lang: string): string {
  return `${PDF_CACHE_PREFIX}${citySlug}:${categorySlug}:${lang}`;
}

export async function getCachedPdf(cacheKey: string): Promise<string | null> {
  return redis.get(cacheKey);
}

export async function setCachedPdf(cacheKey: string, pdfUrl: string): Promise<void> {
  await redis.set(cacheKey, pdfUrl, { ex: PDF_CACHE_TTL });
}

export async function invalidatePdfCache(citySlug: string, categorySlug: string): Promise<void> {
  // Invalidate all language variants
  await Promise.all([
    redis.del(getPdfCacheKey(citySlug, categorySlug, "ar")),
    redis.del(getPdfCacheKey(citySlug, categorySlug, "en")),
  ]);
}

export async function invalidateAllPdfCache(): Promise<void> {
  const keys = await redis.keys(`${PDF_CACHE_PREFIX}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}