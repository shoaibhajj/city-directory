// src/middleware.ts
// Location: src/middleware.ts (NOT inside app/ — must be at src/ root)
//
// This file runs on EVERY request BEFORE any page renders.
// It runs at the Edge (Vercel's CDN layer) — not on your server.
//
// WHY Edge? It's the fastest place to redirect.
// Redirecting /pharmacies → /ar/pharmacies happens at the CDN,
// not after a round-trip to your server.
//
// IMPORTANT LIMITATION: Because this runs at Edge,
// you CANNOT use Prisma, Node.js APIs, or any server-only code here.
// You can only read cookies and URL parameters.
//
// In Phase 1 (Auth), we will ADD auth checks to this middleware.
// For now it only handles locale routing.

import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// createMiddleware handles:
// - Redirecting / → /ar/ (default locale)
// - Redirecting /en/... → /ar/... if wrong locale detected
// - Setting locale cookie for subsequent requests
export default createMiddleware(routing);

export const config = {
  // Run middleware on ALL routes EXCEPT:
  // - /api/* (API routes handle their own auth)
  // - /_next/* (Next.js internals)
  // - /.*\..* (static files like favicon.ico, images)
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
