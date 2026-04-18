// src/lib/auth.ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { env } from "@/env";
import { verifyPassword } from "@/features/auth/utils";
import { SignInSchema } from "@/features/auth/schemas";
import type { Role } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma), // kept for Google OAuth account storage

  // WHY jwt and not database:
  // Auth.js v5 beta does not call adapter.createSession() for Credentials provider.
  // The strategy:"database" setting only applies to OAuth flows in v5 beta.
  // JWT stores the session in an encrypted HttpOnly cookie — no DB query per request.
  // Tradeoff: sessions cannot be instantly revoked (addressed via passwordChangedAt
  // check in the jwt callback — implemented in Phase 2 hardening).
  session: { strategy: "jwt" },

  basePath: "/api/v1/auth",

  pages: {
    signIn: "/ar/sign-in",
    error: "/ar/sign-in",
  },

  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { prompt: "select_account" } },
    }),

    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = SignInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email, deletedAt: null },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await verifyPassword(
          parsed.data.password,
          user.passwordHash,
        );
        if (!isValid) return null;

        return user;
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.id) {
        await prisma.user
          .update({
            where: { id: user.id },
            data: { emailVerified: new Date() },
          })
          .catch(() => {});
      }
      return true;
    },

    // ← NO explicit type annotation on the params — let Auth.js infer it
    async jwt({ token, user, account }) {
      if (user) {
        // user.id is string | undefined on the base User type — assert it exists
        token.id = user.id!;
        // user.role only exists on AdapterUser (our augmentation) — cast once
        token.role = (user as { role: Role }).role;
        token.emailVerified = user.emailVerified ?? null;
      }
      if (account?.provider === "google") {
        token.emailVerified = new Date();
      }
      return token;
    },

    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.emailVerified = token.emailVerified;
      return session;
    },
  },
});
