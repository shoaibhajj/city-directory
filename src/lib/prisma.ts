import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    errorFormat: "minimal",
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * safeQuery — for NON-CRITICAL reads only.
 *
 * Use this when: a DB failure should show an empty state, not crash the page.
 * DO NOT use this for: auth checks, mutations, ownership verification.
 * Those MUST throw so the error boundary catches them.
 *
 * Example:
 *   const listings = await safeQuery(() => getListingsByOwner(userId), [])
 */
export async function safeQuery<T>(
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(
      "[safeQuery] Non-critical query failed, using fallback:",
      err,
    );
    return fallback;
  }
}
