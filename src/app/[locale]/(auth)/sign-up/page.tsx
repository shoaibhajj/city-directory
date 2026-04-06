"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { SignUpSchema, type SignUpInput } from "@/features/auth/schemas";
import { signUpAction } from "@/features/auth/actions";
import { Link } from "@/i18n/navigation"; // ← replaces next/link + useParams
import { useTranslations } from "next-intl";

export default function SignUpPage() {
  const t = useTranslations("auth");
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
  });

  async function onSubmit(data: SignUpInput) {
    setServerError(null);
    const result = await signUpAction(data);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">📧</div>
        <h2 className="text-xl font-semibold text-gray-900">
          {t("signUpSuccessTitle")}
        </h2>
        <p className="text-gray-600 text-sm">{t("signUpSuccessDesc")}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
        {t("signUpTitle")}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("fullName")}
          </label>
          <input
            {...register("name")}
            type="text"
            placeholder={t("fullNamePlaceholder")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">
              {t(errors.name.message!)}
            </p>
          )}
        </div>

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("password")}
          </label>
          <input
            {...register("password")}
            type="password"
            placeholder={t("newPasswordPlaceholder")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            dir="ltr"
          />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">
              {t(errors.password.message!)}
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
          {isSubmitting ? t("signUpLoading") : t("signUpSubmit")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t("haveAccount")}{" "}
        <Link
          href="/sign-in"
          className="text-teal-600 hover:underline font-medium"
        >
          {t("signInLink")}
        </Link>
      </p>
    </div>
  );
}
