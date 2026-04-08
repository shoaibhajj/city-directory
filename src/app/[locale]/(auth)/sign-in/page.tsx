"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { SignInSchema, type SignInInput } from "@/features/auth/schemas";
import { checkSignInRateLimit } from "@/features/auth/actions";
import { signIn } from "next-auth/react";
import { Link, useRouter } from "@/i18n/navigation"; // ← replaces next/link + useParams
import { useTranslations } from "next-intl";

export default function SignInPage() {
  const t = useTranslations("auth");
  const tt = useTranslations("common");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(SignInSchema),
  });

  async function onSubmit(data: SignInInput) {
    setServerError(null);
    setLoading(true);
    try {
      const rl = await checkSignInRateLimit(data.email);
      if (!rl.success) {
        setServerError(rl.error);
        return;
      }

      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (!result?.ok || result?.error) {
        setServerError(t("invalidCredentials"));
        return;
      }

      // Hard navigation so Server Components read the fresh cookie
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
        {t("signInTitle")}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("email")}
          </label>
          <input
            {...register("email")}
            type="email"
            placeholder={t("emailPlaceholder")}
            dir="ltr"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
            placeholder={t("passwordPlaceholder")}
            dir="ltr"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">
              {t(errors.password.message!)}
            </p>
          )}
        </div>

        <div className="text-start">
          <Link
            href="/forgot-password"
            className="text-sm text-teal-600 hover:underline"
          >
            {t("forgotPasswordLink")}
          </Link>
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-red-600 text-sm">{serverError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          {loading ? t("signInLoading") : t("signInSubmit")}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs text-gray-400">
          <span className="bg-white px-2">{tt("or")}</span>
        </div>
      </div>

      <button
        onClick={handleGoogleSignIn}
        type="button"
        className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {/* Google SVG — inline, no external URL */}
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
        </svg>
        {t("signInWithGoogle")}
      </button>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t("noAccount")}{" "}
        <Link
          href="/sign-up"
          className="text-teal-600 hover:underline font-medium"
        >
          {t("createAccount")}
        </Link>
      </p>
    </div>
  );
}
