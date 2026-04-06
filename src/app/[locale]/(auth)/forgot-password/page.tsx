"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ForgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/schemas";
import { forgotPasswordAction } from "@/features/auth/actions";
import { Link } from "@/i18n/navigation"; // ← replaces next/link + useParams
import { useTranslations } from "next-intl";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordInput) {
    await forgotPasswordAction(data.email);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">📧</div>
        <h2 className="text-xl font-semibold text-gray-900">
          {t("forgotPasswordSuccessTitle")}
        </h2>
        <p className="text-gray-600 text-sm">
          {t("forgotPasswordSuccessDesc")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">
        {t("forgotPasswordTitle")}
      </h2>
      <p className="text-sm text-gray-500 text-center mb-6">
        {t("forgotPasswordDesc")}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("email")}
          </label>
          <input
            {...register("email")}
            type="email"
            placeholder={t("emailPlaceholder")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            dir="ltr"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">
              {t(errors.email.message!)}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          {isSubmitting ? t("sendingResetLink") : t("sendResetLink")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {/* href="/sign-in" — next-intl adds /{locale}/ prefix automatically */}
        <Link href="/sign-in" className="text-teal-600 hover:underline">
          {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
