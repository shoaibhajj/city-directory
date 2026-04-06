// src/features/auth/actions.ts
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

// ─── Helper ──────────────────────────────────────────────────────────────────

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
}

// ─── Sign Up ─────────────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; field?: string };

export async function signUpAction(data: SignUpInput): Promise<ActionResult> {
  // 1. Validate input
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

  // 2. Rate limit by IP
  const ip = await getClientIp();
  const rl = await checkRateLimit(authRateLimit, `signup:${ip}`);
  if (!rl.success) {
    return { success: false, error: "tooManyAttempts" };
  }

  // 3. Check email not already registered
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Don't confirm if account exists (user enumeration prevention is secondary here
    // since sign-up naturally reveals "email taken" — this is acceptable for UX)
    if (existing) {
      return { success: false, error: "emailTaken", field: "email" };
    }
  }

  // 4. Hash password
  const passwordHash = await hashPassword(password);

  // 5. Create User
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  // 6. Generate verification token
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  // 7. Send verification email — fire-and-forget, never block the response
  sendVerificationEmail(email, name, rawToken).catch((err) =>
    console.error("[signUpAction] email send failed:", err),
  );

  // 8. Audit log
  writeAuditLog({
    actorId: user.id,
    actorEmail: email,
    actorRole: user.role,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    ipAddress: ip,
  });

  // 9. Return success — do NOT sign them in. Force email verification first.
  return { success: true };
}

// ───  checkSignInRateLimit ─────────────────────────────────────────────────────────────────

export async function checkSignInRateLimit(
  email: string,
): Promise<ActionResult> {
  const ip = await getClientIp();
  const byEmail = await checkRateLimit(authRateLimit, `signin:${email}`);
  const byIp = await checkRateLimit(authRateLimit, `signin:ip:${ip}`);

  if (!byEmail.success || !byIp.success) {
    return { success: false, error: "tooManyAttempts" };
  }

  return { success: true };
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

export async function verifyEmailAction(
  rawToken: string,
): Promise<ActionResult> {
  if (!rawToken) return { success: false, error: "tokenMissing" };

  const tokenHash = hashToken(rawToken);

  // Find token: must exist, not expired, not used
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) return { success: false, error: "tokenInvalid" };
  if (record.usedAt)
    if (record.usedAt) return { success: false, error: "tokenUsed" };
  if (record.expiresAt < new Date())
    if (record.expiresAt < new Date())
      return { success: false, error: "tokenExpired" };

  // Update user and token atomically
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
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  email: string,
): Promise<ActionResult> {
  const parsed = ForgotPasswordSchema.safeParse({ email });
  if (!parsed.success)
    return { success: false, error: "البريد الإلكتروني غير صالح." };

  // Rate limit by email to prevent flooding
  const rl = await checkRateLimit(passwordResetRateLimit, `forgot:${email}`);
  if (!rl.success) {
    if (!rl.success) return { success: false, error: "tooManyResetAttempts" };
  }

  const user = await prisma.user.findUnique({
    where: { email, deletedAt: null },
  });

  // CRITICAL: return the EXACT same response whether user exists or not.
  // This prevents user enumeration — attacker cannot learn if an email is registered. [file:1]
  if (!user) return { success: true };

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  sendPasswordResetEmail(email, rawToken).catch((err) =>
    console.error("[forgotPasswordAction] email send failed:", err),
  );

  return { success: true };
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPasswordAction(
  rawToken: string,
  newPassword: string,
  confirmPassword: string,
): Promise<ActionResult> {
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
    // NOTE: With JWT strategy, this does not invalidate active browser sessions.
    // Phase 2 hardening: add passwordChangedAt to User, check in jwt callback.
    // For now, existing JWT sessions expire naturally (default: 30 days).
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
}

// ─── Delete Account ───────────────────────────────────────────────────────────

export async function deleteAccountAction(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "unauthorized" };

  const userId = session.user.id;

  await prisma.$transaction([
    // Soft delete with anonymization
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
    // Force sign-out on all devices
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

  await signOut({ redirect: false });

  return { success: true };
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/ar/sign-in" });
}
