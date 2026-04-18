-- Add banned fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedReason" TEXT;