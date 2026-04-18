-- Add banned fields to User table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bannedReason" TEXT;