"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ResetPasswordSchema,
  type ResetPasswordInput,
} from "@/features/auth/schemas";
import { resetPasswordAction } from "@/features/auth/actions";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation"; // ← replaces next/link + useParams
import { useTranslations } from "next-intl";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { token },
  });

  async function onSubmit(data: ResetPasswordInput) {
    setServerError(null);
    const result = await resetPasswordAction(
      data.token,
      data.newPassword,
      data.confirmPassword,
    );
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    setSuccess(true);
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-red-500 text-sm">{t("invalidResetLink")}</p>
        <Link
          href="/forgot-password"
          className="text-teal-600 text-sm hover:underline"
        >
          {t("requestNewLink")}
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-semibold text-gray-900">
          {t("resetSuccessTitle")}
        </h2>
        <p className="text-gray-600 text-sm">{t("resetSuccessDesc")}</p>
        <Link
          href="/sign-in"
          className="inline-block bg-teal-600 text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-teal-700 transition-colors"
        >
          {t("signInLink")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
        {t("resetPasswordTitle")}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register("token")} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("newPassword")}
          </label>
          <input
            {...register("newPassword")}
            type="password"
            placeholder={t("newPasswordPlaceholder")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            dir="ltr"
          />
          {errors.newPassword && (
            <p className="text-red-500 text-xs mt-1">
              {t(errors.newPassword.message!)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("confirmPassword")}
          </label>
          <input
            {...register("confirmPassword")}
            type="password"
            placeholder={t("confirmPasswordPlaceholder")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            dir="ltr"
          />
          {errors.confirmPassword && (
            <p className="text-red-500 text-xs mt-1">
              {t(errors.confirmPassword.message!)}
            </p>
          )}
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-red-600 text-sm">{t(serverError)}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          {isSubmitting ? t("savingPassword") : t("savePassword")}
        </button>
      </form>
    </div>
  );
}
