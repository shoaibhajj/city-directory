"use server";

import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";
import {
  authRateLimit,
  passwordResetRateLimit,
  checkRateLimit,
} from "@/lib/rate-limit";
import {
  hashPassword,
  generateSecureToken,
  hashToken,
} from "@/features/auth/utils";
import {
  SignUpSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  type SignUpInput,
} from "@/features/auth/schemas";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "@/features/auth/emails";
import { writeAuditLog } from "@/lib/audit";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Auth-specific ActionResult keeps `field` for form field highlighting.
 * WHY not use the shared actionError/actionSuccess from @/lib/action-response?
 * The shared helpers don't carry `field`. Auth forms need to know WHICH
 * field caused the error to focus the correct input and show inline feedback.
 */
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; field?: string };

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Normalizes unexpected errors to a consistent i18n key.
 * Only call this in the catch block — expected/controlled errors
 * return typed ActionResult directly without going through here.
 */
function toUnexpectedError(err: unknown, context: string): ActionResult {
  console.error(`[${context}]`, err);
  return { success: false, error: "unexpectedError" };
}

// ─── signUpAction ─────────────────────────────────────────────────────────────

export async function signUpAction(data: SignUpInput): Promise<ActionResult> {
  try {
    // ── Validate input ──
    const parsed = SignUpSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        field: firstError.path[0] as string,
      };
    }
    const { name, email, password } = parsed.data;

    // ── Rate limit by IP ──
    const ip = await getClientIp();
    const rl = await checkRateLimit(authRateLimit, `signup:${ip}`);
    if (!rl.success) {
      return { success: false, error: "tooManyAttempts" };
    }

    // ── Check email not already registered ──
    // Note: a race condition is still possible (two simultaneous signups with
    // the same email). The Prisma.P2002 catch below handles that edge case.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "emailTaken", field: "email" };
    }

    // ── Hash password ──
    const passwordHash = await hashPassword(password);

    // ── Create user ──
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    // ── Generate and store verification token ──
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // ── Send verification email — fire-and-forget, never blocks response ──
    sendVerificationEmail(email, name, rawToken).catch((err) =>
      console.error("[signUpAction] email send failed:", err),
    );

    // ── Audit log — fire-and-forget ──
    writeAuditLog({
      actorId: user.id,
      actorEmail: email,
      actorRole: user.role,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      ipAddress: ip,
    });

    // Do NOT sign them in — force email verification first
    return { success: true };
  } catch (err) {
    // Prisma P2002 = unique constraint violation
    // This catches the race condition: two simultaneous signups for the same email
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { success: false, error: "emailTaken", field: "email" };
    }
    return toUnexpectedError(err, "signUpAction");
  }
}

// ─── checkSignInRateLimit ─────────────────────────────────────────────────────

export async function checkSignInRateLimit(
  email: string,
): Promise<ActionResult> {
  try {
    const ip = await getClientIp();

    const [byEmail, byIp] = await Promise.all([
      checkRateLimit(authRateLimit, `signin:${email}`),
      checkRateLimit(authRateLimit, `signin:ip:${ip}`),
    ]);

    if (!byEmail.success || !byIp.success) {
      return { success: false, error: "tooManyAttempts" };
    }

    return { success: true };
  } catch (err) {
    return toUnexpectedError(err, "checkSignInRateLimit");
  }
}

// ─── verifyEmailAction ────────────────────────────────────────────────────────

export async function verifyEmailAction(
  rawToken: string,
): Promise<ActionResult> {
  try {
    if (!rawToken) return { success: false, error: "tokenMissing" };

    const tokenHash = hashToken(rawToken);

    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // Order matters: check existence first, then consumed state, then expiry
    if (!record) return { success: false, error: "tokenInvalid" };
    if (record.usedAt) return { success: false, error: "tokenUsed" };
    if (record.expiresAt < new Date())
      return { success: false, error: "tokenExpired" };

    // Update user and mark token used atomically
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() }, // prevents token reuse
      }),
    ]);

    writeAuditLog({
      actorId: record.userId,
      actorEmail: record.user.email,
      actorRole: record.user.role,
      action: "EMAIL_VERIFIED",
      entityType: "User",
      entityId: record.userId,
    });

    return { success: true };
  } catch (err) {
    return toUnexpectedError(err, "verifyEmailAction");
  }
}

// ─── forgotPasswordAction ─────────────────────────────────────────────────────

export async function forgotPasswordAction(
  email: string,
): Promise<ActionResult> {
  try {
    const parsed = ForgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      return { success: false, error: "invalidEmail", field: "email" };
    }

    // ── Rate limit by email ──
    const rl = await checkRateLimit(passwordResetRateLimit, `forgot:${email}`);
    if (!rl.success) {
      return { success: false, error: "tooManyResetAttempts" };
    }

    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    // SECURITY CRITICAL: return the EXACT same response whether the user exists or not.
    // This prevents user enumeration — an attacker cannot learn if an email is registered
    // by observing different response shapes, messages, or timing.
    if (!user) return { success: true };

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Fire-and-forget — never block response on email delivery
    sendPasswordResetEmail(email, rawToken).catch((err) =>
      console.error("[forgotPasswordAction] email send failed:", err),
    );

    return { success: true };
  } catch (err) {
    // SECURITY: even on unexpected errors, return success to prevent enumeration.
    // We still log internally so the team can investigate.
    console.error("[forgotPasswordAction]", err);
    return { success: true };
  }
}

// ─── resetPasswordAction ──────────────────────────────────────────────────────

export async function resetPasswordAction(
  rawToken: string,
  newPassword: string,
  confirmPassword: string,
): Promise<ActionResult> {
  try {
    const parsed = ResetPasswordSchema.safeParse({
      token: rawToken,
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        field: firstError.path[0] as string,
      };
    }

    const tokenHash = hashToken(rawToken);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // Check existence, consumed state, expiry — in that order
    if (!record) return { success: false, error: "resetTokenInvalid" };
    if (record.usedAt) return { success: false, error: "resetTokenUsed" };
    if (record.expiresAt < new Date())
      return { success: false, error: "resetTokenExpired" };

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Force re-login on all devices.
      // NOTE: With Auth.js database sessions this is effective immediately.
      // JWT strategy would require passwordChangedAt field check in jwt callback (Phase 2 hardening).
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    writeAuditLog({
      actorId: record.userId,
      actorEmail: record.user.email,
      actorRole: record.user.role,
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: record.userId,
      ipAddress: await getClientIp(),
    });

    return { success: true };
  } catch (err) {
    return toUnexpectedError(err, "resetPasswordAction");
  }
}

// ─── deleteAccountAction ──────────────────────────────────────────────────────

export async function deleteAccountAction(): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "unauthorized" };
    }

    const userId = session.user.id;

    await prisma.$transaction([
      // Soft-delete with anonymization — preserves audit trail while removing PII
      prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          email: `deleted_${userId}@deleted.local`,
          name: "Deleted User",
          passwordHash: null,
          image: null,
        },
      }),
      // Invalidate all active sessions immediately
      prisma.session.deleteMany({ where: { userId } }),
    ]);

    writeAuditLog({
      actorId: userId,
      actorEmail: session.user.email ?? null,
      actorRole: session.user.role,
      action: "USER_DELETED",
      entityType: "User",
      entityId: userId,
      ipAddress: await getClientIp(),
    });

    // Sign out after DB operations succeed.
    // If signOut throws (e.g. Auth.js internal error), the account is already
    // anonymized and sessions deleted — the user is effectively logged out.
    // We log but still return success since the deletion succeeded.
    try {
      await signOut({ redirect: false });
    } catch (signOutErr) {
      console.error(
        "[deleteAccountAction] signOut failed after successful deletion:",
        signOutErr,
      );
    }

    return { success: true };
  } catch (err) {
    return toUnexpectedError(err, "deleteAccountAction");
  }
}

// ─── signOutAction ────────────────────────────────────────────────────────────

/**
 * Returns void intentionally — callers use fire-and-forget pattern.
 * Auth.js signOut with redirectTo handles the navigation server-side.
 * On failure, we log silently; the user remains on the page they were on,
 * which is acceptable degradation (they can try again).
 */
export async function signOutAction(): Promise<void> {
  try {
    await signOut({ redirectTo: "/ar/sign-in" });
  } catch (err) {
    // Auth.js sometimes throws a NEXT_REDIRECT which is NOT an error —
    // it is the redirect mechanism itself. Re-throw it so Next.js handles it.
    if (
      err instanceof Error &&
      (err.message === "NEXT_REDIRECT" || err.message.includes("NEXT_REDIRECT"))
    ) {
      throw err;
    }
    console.error("[signOutAction]", err);
  }
}
