// src/features/auth/utils.ts
import bcrypt from "bcryptjs";
import crypto from "crypto";

const BCRYPT_ROUNDS = 12; // 12 rounds ≈ 300ms on modern hardware — slow enough to deter brute force

/**
 * Hash a plaintext password. Never store plaintext passwords.
 * Call this only in server actions (bcryptjs is CPU-intensive).
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored hash.
 * Uses constant-time comparison internally — safe against timing attacks.
 */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Generate a cryptographically random token to send in emails.
 * 32 bytes = 256 bits of entropy = practically impossible to guess.
 * Returns hex string (64 characters).
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a raw token before storing in DB.
 * WHY: If the DB is breached, attackers get only SHA-256 hashes — they
 * cannot use them to verify email or reset passwords without the raw token
 * (which was only ever sent to the user's email). [file:1]
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
