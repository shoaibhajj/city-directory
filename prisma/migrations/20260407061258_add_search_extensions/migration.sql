-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- GIN index on full-text searchable column
-- Column name is "searchableText" (camelCase) — Prisma preserves case with quoted identifiers
CREATE INDEX IF NOT EXISTS idx_bp_search_gin
  ON business_profiles
  USING GIN ("searchableText" gin_trgm_ops);

-- GIN index on Arabic name for autocomplete/name-only searches
CREATE INDEX IF NOT EXISTS idx_bp_name_ar_gin
  ON business_profiles
  USING GIN ("nameAr" gin_trgm_ops);

-- Partial index for the most common public directory query
-- WHERE status = 'ACTIVE' AND deleted_at IS NULL ORDER BY published_at DESC
CREATE INDEX IF NOT EXISTS idx_bp_active_published
  ON business_profiles (status, "deletedAt", "publishedAt" DESC)
  WHERE "deletedAt" IS NULL;