-- This is an empty migration.-- ═══════════════════════════════════════════════════════════
-- Phase 5: Media Upload System — Schema Additions
-- ═══════════════════════════════════════════════════════════

-- 1. Make cloudinaryPublicId nullable — the 2-phase upload creates the DB
--    record BEFORE the Cloudinary upload, so publicId isn't known yet.
ALTER TABLE "media_files" ALTER COLUMN "cloudinaryPublicId" DROP NOT NULL;

-- 2. Make url nullable for the same reason
ALTER TABLE "media_files" ALTER COLUMN "url" DROP NOT NULL;

-- 3. Add image subtypes — Phase 2 only defined IMAGE/VIDEO.
--    Phase 5 needs to distinguish cover, logo, and gallery photos.
--    We ADD the new values (PostgreSQL cannot drop enum values without
--    recreating the type, so IMAGE stays but will be unused going forward).
ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'COVER';
ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'LOGO';
ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'PHOTO';

-- 4. Add mimeType — stores the server-detected MIME after magic bytes check
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "mimeType" TEXT;

-- 5. Add reviewer tracking — records which admin approved/rejected and when
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

-- 6. Add cover/logo ID references on business_profiles
--    WHY plain TEXT and not a foreign key?
--    A FK from BusinessProfile → MediaFile AND MediaFile → BusinessProfile
--    creates a circular dependency PostgreSQL cannot resolve without
--    deferred constraints (unsupported in Prisma 6). Plain TEXT reference
--    with application-level enforcement is the correct pragmatic solution.
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "coverImageId" TEXT;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "logoImageId" TEXT;

-- 7. Add VIDEO_PENDING_REVIEW notification type
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VIDEO_PENDING_REVIEW';