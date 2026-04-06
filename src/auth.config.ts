// src/auth.config.ts
// EDGE-SAFE: No Node.js APIs, no Prisma, no bcrypt.
// This file is imported by middleware — it runs on Vercel's Edge Runtime.
// It only defines the shape of auth (providers list, pages, callbacks)
// without any heavy dependencies.
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  // Pages config is needed here so middleware knows where to redirect
  pages: {
    signIn: "/ar/sign-in",
    error: "/ar/sign-in",
  },

  providers: [
    // Google is listed here so Auth.js knows it exists at edge level.
    // Actual OAuth flow happens in the full auth.ts, not here.
    // We pass empty strings because the edge config never initiates OAuth —
    // it only reads the existing session cookie.
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    // Credentials provider is NOT listed here — it requires bcrypt
    // which is a Node.js-only module. It lives only in auth.ts below.
  ],

  callbacks: {
    // This callback runs at edge — it receives the session from the cookie
    // and decides if the user is authorized.
    // No DB query here — just reads what's already in the session token.
    authorized({}) {
      // We handle redirects manually in middleware, so just return true here.
      // The actual route protection logic lives in middleware.ts.
      return true;
    },
  },
};
