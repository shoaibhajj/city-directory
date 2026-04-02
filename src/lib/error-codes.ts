// src/lib/error-codes.ts
// Location: src/lib/error-codes.ts
//
// Centralized API error codes.
//
// WHY an enum instead of raw strings?
// If you type "AUTH_001" in 10 files and later rename it to "AUTH_INVALID_CREDENTIALS",
// TypeScript won't catch the old strings. With an enum, TypeScript catches every usage.
//
// NAMING CONVENTION: DOMAIN_CODE
// AUTH = authentication/authorization
// LISTING = business listing operations
// MEDIA = file upload/management
// USER = user account operations
// SYSTEM = infrastructure/unexpected errors

export const ErrorCodes = {
  // ── Auth ────────────────────────────────────────────────────────────
  AUTH_INVALID_CREDENTIALS: "AUTH_001",
  AUTH_EMAIL_NOT_VERIFIED: "AUTH_002",
  AUTH_EMAIL_ALREADY_EXISTS: "AUTH_003",
  AUTH_INVALID_TOKEN: "AUTH_004",
  AUTH_TOKEN_EXPIRED: "AUTH_005",
  AUTH_RATE_LIMITED: "AUTH_006",
  AUTH_UNAUTHORIZED: "AUTH_007", // Not logged in
  AUTH_FORBIDDEN: "AUTH_008", // Logged in but wrong role/ownership

  // ── Listing ─────────────────────────────────────────────────────────
  LISTING_NOT_FOUND: "LISTING_001",
  LISTING_LIMIT_REACHED: "LISTING_002",
  LISTING_RATE_LIMITED: "LISTING_003",
  LISTING_MISSING_REQUIRED_FIELDS: "LISTING_004",
  LISTING_INVALID_STATE_TRANSITION: "LISTING_005",

  // ── Media ────────────────────────────────────────────────────────────
  MEDIA_INVALID_TYPE: "MEDIA_001",
  MEDIA_SIZE_EXCEEDED: "MEDIA_002",
  MEDIA_COUNT_EXCEEDED: "MEDIA_003",
  MEDIA_DURATION_EXCEEDED: "MEDIA_004",
  MEDIA_NOT_FOUND: "MEDIA_005",

  // ── User ─────────────────────────────────────────────────────────────
  USER_NOT_FOUND: "USER_001",

  // ── Validation ───────────────────────────────────────────────────────
  VALIDATION_ERROR: "VALIDATION_001",

  // ── System ───────────────────────────────────────────────────────────
  SYSTEM_INTERNAL_ERROR: "SYSTEM_001",
  SYSTEM_SERVICE_UNAVAILABLE: "SYSTEM_002",
} as const;

// TypeScript type for all valid error codes
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
