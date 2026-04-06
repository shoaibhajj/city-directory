// src/features/auth/schemas.ts
// Error messages are translation keys relative to the 'auth' namespace.
// Components call t(errors.field?.message) to get the translated string.
import { z } from "zod";

export const SignUpSchema = z.object({
  name: z
    .string()
    .min(2, "validation.nameTooShort")
    .max(100, "validation.nameTooLong"),
  email: z.string().email("validation.invalidEmail"),
  password: z
    .string()
    .min(8, "validation.passwordTooShort")
    .regex(/[A-Z]/, "validation.passwordNeedsUppercase")
    .regex(/[0-9]/, "validation.passwordNeedsNumber"),
});

export const SignInSchema = z.object({
  email: z.string().email("validation.invalidEmail"),
  password: z.string().min(1, "validation.passwordRequired"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("validation.invalidEmail"),
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: z
      .string()
      .min(8, "validation.passwordTooShort")
      .regex(/[A-Z]/, "validation.passwordNeedsUppercase")
      .regex(/[0-9]/, "validation.passwordNeedsNumber"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "validation.passwordsMustMatch",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
