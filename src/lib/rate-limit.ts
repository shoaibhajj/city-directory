import { Ratelimit } from "@upstash/ratelimit";
// src/lib/rate-limit.ts
// WHY sliding window over fixed window?
// Fixed window: attacker sends 5 requests at 11:59:59, 5 more at 12:00:01 — 10 in 2 seconds.
// Sliding window: counts requests in the last N seconds from NOW — no boundary exploit. [file:1]

import { redis } from "@/lib/redis";

// 5 login attempts per 15 minutes per identifier (email or IP)
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "rl:auth",
});

// More aggressive limit for password reset — prevents email flooding
export const passwordResetRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  analytics: true,
  prefix: "rl:reset",
});

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: Date;
};

/**
 * Call this at the start of every sensitive server action.
 * identifier: use email for auth actions (more specific than IP alone)
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string,
): Promise<RateLimitResult> {
  const { success, remaining, reset } = await limiter.limit(identifier);
  return { success, remaining, reset: new Date(reset) };
}
