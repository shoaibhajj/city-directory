// src/middleware.ts
import { routing } from "@/i18n/routing";
import createMiddleware from "next-intl/middleware";

// WHY no auth() here:
// With jwt strategy, decrypting the JWT requires crypto operations that
// are safe on Edge, BUT combining next-intl middleware with Auth.js auth()
// wrapper causes double-execution and locale detection issues.
// Route protection (session check, emailVerified, role) lives in Server
// Component layouts via auth() from lib/auth.ts — which has full Node.js
// access and is the correct place for these checks.
const intlMiddleware = createMiddleware(routing);

export default intlMiddleware;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
