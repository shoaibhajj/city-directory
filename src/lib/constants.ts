// src/lib/constants.ts
// Location: src/lib/constants.ts
//
// WHY a constants file?
// The number 10 means nothing. MAX_PHOTOS_PER_LISTING means something.
// Constants give names to numbers and strings, making code self-documenting.
//
// RULE: If a value appears in more than one place, it belongs here.
// If you change it here, it changes everywhere automatically.

export const APP_NAME = "دليل النبك"; // "Al Nabik Directory"
export const DEFAULT_LOCALE = "ar" as const;
export const SUPPORTED_LOCALES = ["ar", "en"] as const;

// ── Media Limits ─────────────────────────────────────────────────────
// These are the DEFAULT values — can be overridden by PlatformSetting in DB
export const MEDIA_LIMITS = {
  MAX_PHOTOS_PER_LISTING: 10,
  MAX_VIDEOS_PER_LISTING: 3,
  MAX_IMAGE_SIZE_MB: 10,
  MAX_VIDEO_SIZE_MB: 100,
  MAX_VIDEO_DURATION_SECONDS: 300, // 5 minutes

  // Supported file types — checked both client and server side
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"] as const,
  ALLOWED_VIDEO_TYPES: ["video/mp4", "video/webm"] as const,

  // Image processing output settings
  IMAGE_MAX_WIDTH: 1920,
  IMAGE_QUALITY: 82, // WebP quality 0-100. 82 = good quality, ~60% smaller than JPEG
  THUMBNAIL_WIDTH: 400,
  THUMBNAIL_HEIGHT: 300,
  THUMBNAIL_QUALITY: 70,
} as const;

// ── Business Rules ────────────────────────────────────────────────────
export const BUSINESS_RULES = {
  MAX_LISTINGS_PER_OWNER: 3,
  LISTING_RATE_LIMIT_PER_DAY: 1, // Max new listings per user per 24 hours
  MAX_PHONE_NUMBERS: 5,
  MAX_SOCIAL_LINKS: 8,
  SLUG_MAX_LENGTH: 80,
} as const;

// ── Rate Limiting ─────────────────────────────────────────────────────
export const RATE_LIMITS = {
  // Auth endpoints (per IP)
  AUTH_SIGN_UP_PER_HOUR: 3,
  AUTH_SIGN_IN_PER_WINDOW: 5,
  AUTH_SIGN_IN_WINDOW_SECONDS: 15 * 60, // 15 minutes
  AUTH_FORGOT_PASSWORD_PER_HOUR: 3,

  // Media uploads (per user)
  MEDIA_UPLOADS_PER_HOUR: 20,

  // PDF downloads (per IP)
  PDF_DOWNLOADS_PER_10_MIN: 5,
} as const;

// ── Pagination ────────────────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// ── Token Expiry ──────────────────────────────────────────────────────
export const TOKEN_EXPIRY = {
  EMAIL_VERIFICATION_HOURS: 24,
  PASSWORD_RESET_HOURS: 1,
} as const;
