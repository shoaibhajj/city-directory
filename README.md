# Phase 1 — Authentication System

## دليل النبك | Nabk City Directory

> **Status:** ✅ Complete  
> **Complexity:** Medium  
> **Time Taken:** 4–5 days  
> **Dependencies:** Phase 0 (Project Bootstrap)

---

## Table of Contents

1. [Why Authentication First?](#1-why-authentication-first)
2. [Authentication Theory](#2-authentication-theory)
   - [Identity vs. Authorization](#identity-vs-authorization)
   - [How Sessions Work](#how-sessions-work)
   - [JWT vs. Database Sessions](#jwt-vs-database-sessions)
   - [Why Auth.js v5?](#why-authjs-v5)
   - [Security Primitives](#security-primitives)
3. [Architecture Overview](#3-architecture-overview)
4. [File Structure](#4-file-structure)
5. [Step-by-Step Implementation](#5-step-by-step-implementation)
   - [Step 1 — Dependencies](#step-1--dependencies)
   - [Step 2 — Prisma Schema](#step-2--prisma-schema)
   - [Step 3 — Environment Variables](#step-3--environment-variables)
   - [Step 4 — TypeScript Type Augmentation](#step-4--typescript-type-augmentation)
   - [Step 5 — Auth.js Configuration](#step-5--authjs-configuration)
   - [Step 6 — Route Handler](#step-6--route-handler)
   - [Step 7 — Security Utilities](#step-7--security-utilities)
   - [Step 8 — Rate Limiting](#step-8--rate-limiting)
   - [Step 9 — Zod Schemas](#step-9--zod-schemas)
   - [Step 10 — Audit Logging](#step-10--audit-logging)
   - [Step 11 — Email Sending](#step-11--email-sending)
   - [Step 12 — Server Actions](#step-12--server-actions)
   - [Step 13 — Middleware](#step-13--middleware)
   - [Step 14 — Auth Pages (UI)](#step-14--auth-pages-ui)
   - [Step 15 — i18n Translation Keys](#step-15--i18n-translation-keys)
6. [Critical Bugs Fixed During Implementation](#6-critical-bugs-fixed-during-implementation)
7. [Security Decisions Reference](#7-security-decisions-reference)
8. [Phase 1 Done Criteria](#8-phase-1-done-criteria)
9. [What Phase 2 Will Harden](#9-what-phase-2-will-harden)

---

## 1. Why Authentication First?

Every feature in this application needs to know **WHO** is making the request:

- A business owner can only edit **their own** listing — not someone else's.
- An admin can moderate listings — but only if the system knows they are an admin.
- A guest browsing the directory gets read-only access — the system needs to
  know they have no session.

Without a working identity system, you cannot build anything that has ownership,
permissions, or personalization. **Auth is the bedrock that every other feature
stands on.**

---

## 2. Authentication Theory

### Identity vs. Authorization

These two concepts are often confused but are fundamentally different:

| Concept            | Question answered           | Example                                           |
| ------------------ | --------------------------- | ------------------------------------------------- |
| **Authentication** | Who are you?                | "You are user ID `abc123`, role `BUSINESS_OWNER`" |
| **Authorization**  | What are you allowed to do? | "You can edit listing `xyz` because you own it"   |

Phase 1 implements **Authentication only**. Authorization (ownership checks,
RBAC enforcement) happens in Server Actions and is built in later phases.

---

### How Sessions Work

When a user signs in, the server needs a way to remember them across future
requests. HTTP is stateless — every request arrives with no memory of the last
one. Sessions solve this:
User submits email + password

Server verifies credentials

Server creates a session token (a long random string or encrypted JWT)

Server sends the token to the browser as an HttpOnly cookie

Browser attaches the cookie to every future request automatically

Server reads the cookie, decodes the token, and knows who is making the request

text

The key security property: the cookie is **HttpOnly** — JavaScript running on
the page cannot read it. This prevents XSS attacks from stealing the session.

---

### JWT vs. Database Sessions

There are two dominant approaches to storing session state:

#### Database Sessions

- Server stores the session in a database table (`sessions`)
- Cookie contains a random opaque token (e.g., `abf3c9...`)
- On every request: server looks up the token in the DB → finds the user record
- **Advantage:** Instant revocation — delete the row, the session is gone
- **Disadvantage:** DB query on every single request

#### JWT Sessions (what we use)

- Server creates a signed/encrypted JSON payload containing user data
- Cookie contains the entire encrypted payload (a JWE/JWS token)
- On every request: server decrypts the cookie, reads the user data — **no DB query**
- **Advantage:** Zero DB queries per request — faster, scales better
- **Disadvantage:** Cannot instantly revoke — valid until it expires

#### Why We Chose JWT (and it was not the original plan)

The original design called for `strategy: "database"`. After implementation it
was discovered that **Auth.js v5 beta does not call `adapter.createSession()`
for the Credentials provider** — only for OAuth providers. Using
`strategy: "database"` with Credentials caused:

1. `authorize()` would run and return the user ✅
2. Auth.js would write a JWT to the cookie instead of creating a DB session ❌
3. `auth()` in layouts would query `SELECT FROM Session WHERE token = ?`
4. No row existed → session returned `null` → user stuck on sign-in page

The fix: switch to `strategy: "jwt"`. The PrismaAdapter is kept for Google
OAuth account linking. The JWT tradeoff (no instant revocation) will be
addressed in Phase 2 by adding a `passwordChangedAt` field and checking it
inside the `jwt` callback.

---

### Why Auth.js v5?

Auth.js (formerly NextAuth.js) is a security-focused library maintained by a
dedicated team. Building auth from scratch is a common source of critical
vulnerabilities:

| Attack           | What a hand-rolled implementation misses                | How Auth.js handles it                 |
| ---------------- | ------------------------------------------------------- | -------------------------------------- |
| CSRF             | Missing or incorrectly validated CSRF token             | Built-in CSRF token on every form      |
| Session fixation | Not rotating session ID after privilege change          | Session rotation built into OAuth flow |
| Cookie security  | Missing `Secure`, `HttpOnly`, `SameSite` flags          | Set correctly by default               |
| Timing attacks   | String comparison reveals valid vs. invalid tokens      | Constant-time comparison everywhere    |
| Open redirect    | Trusting user-supplied `callbackUrl` without validation | URL validation enforced by the library |

---

### Security Primitives

#### bcrypt

Passwords are **never stored as plaintext**. They are hashed using bcrypt with
12 rounds.
plaintext: "MyPassword1"
↓ bcrypt(rounds=12)
hash: "$2b$12$X9v4qzR..." (stored in DB)

text

**Why 12 rounds?** Each additional round doubles the computation time. 12 rounds
takes ~300ms on modern hardware. Slow enough to deter brute force, fast enough
that real users do not notice.

**Why bcryptjs and not bcrypt?** The npm `bcrypt` package uses native C++
bindings that do not work in all Next.js deployment environments. `bcryptjs` is
pure JavaScript — works everywhere.

#### Token Security (email verification + password reset)

Tokens sent in emails follow a two-layer design:
Generate: rawToken = crypto.randomBytes(32).toString("hex")
→ 256 bits of entropy, impossible to guess

Hash: tokenHash = SHA-256(rawToken)

Store: tokenHash in DB (never the raw token)

Send: rawToken in email link

Verify: hash the received token → compare to DB record

text

**Why hash the token before storing?** If the database is breached, the attacker
gets only SHA-256 hashes. They cannot use these hashes to verify emails or reset
passwords — they need the raw token which was sent only to the user's email inbox.
This is the same principle used by GitHub's password reset flow.

#### User Enumeration Prevention

In `forgotPasswordAction`, the response is identical whether or not the email
exists in the database:

```typescript
// Attacker sends request for attacker@evil.com
// They CANNOT tell from the response whether that email is registered
if (!user) return { success: true }; // same response as real user
```

This prevents attackers from probing which email addresses are registered.

---

## 3. Architecture Overview

Browser
│ ├─ GET /ar/dashboard
│ ↓
│ [Middleware] — next-intl only, no auth check (Edge-safe)
│ ↓
│ [DashboardLayout] — Server Component, calls auth()
│ ↓ auth() decrypts JWT cookie, returns session
│ session === null → redirect /ar/sign-in
│ session.emailVerified === null → redirect /ar/verify-email
│ session OK → render dashboard ✅
│ ├─ POST sign-in form
│ ↓
│ signIn("credentials", { redirect: false }) ← next-auth/react (client)
│ ↓
│ POST /api/v1/auth/callback/credentials
│ ↓
│ authorize() → verifyPassword() → returns user
│ ↓
│ jwt() callback → encodes id, role, emailVerified into JWT
│ ↓
│ Set-Cookie: authjs.session-token = <JWE encrypted JWT>
│ ↓
│ window.location.href = /ar/dashboard ← hard navigation reads fresh cookie
│ └─ POST sign-up form
↓
signUpAction() — Server Action
↓
validate → check email → hashPassword → createUser
↓
generateSecureToken → hashToken → store EmailVerificationToken
↓
sendVerificationEmail (fire-and-forget)
↓
return success (user NOT signed in — must verify email first)

text

---

## 4. File Structure

src/
├── lib/
│ ├── auth.ts # Auth.js v5 full configuration
│ ├── rate-limit.ts # Upstash Redis sliding window limiters
│ └── audit.ts # Fire-and-forget audit log writer
│
├── features/auth/
│ ├── actions.ts # All Server Actions
│ ├── schemas.ts # Zod validation schemas
│ ├── utils.ts # hashPassword, verifyPassword, tokens
│ └── emails.ts # Resend email senders
│
├── types/
│ └── next-auth.d.ts # TypeScript module augmentation
│
├── app/[locale]/
│ ├── (auth)/
│ │ ├── layout.tsx # Centered card layout
│ │ ├── sign-in/page.tsx
│ │ ├── sign-up/page.tsx
│ │ ├── forgot-password/page.tsx
│ │ ├── reset-password/page.tsx
│ │ └── verify-email/page.tsx
│ │
│ ├── (dashboard)/
│ │ ├── layout.tsx # Session + emailVerified guard
│ │ └── dashboard/page.tsx
│ │
│ └── api/v1/auth/[...nextauth]/
│ └── route.ts # Auth.js HTTP route handler
│
├── middleware.ts # next-intl only — no auth at edge
│
messages/
├── ar.json # Arabic translations
└── en.json # English translations

text

---

## 5. Step-by-Step Implementation

### Step 1 — Dependencies

```bash
pnpm add next-auth@beta @auth/prisma-adapter bcryptjs resend \
         react-hook-form @hookform/resolvers
pnpm add -D @types/bcryptjs
```

| Package                | Purpose                          | Why this one                   |
| ---------------------- | -------------------------------- | ------------------------------ |
| `next-auth@beta`       | Auth.js v5 — session, OAuth, JWT | App Router native              |
| `@auth/prisma-adapter` | Connects Auth.js to Prisma       | Official adapter               |
| `bcryptjs`             | Password hashing                 | Pure JS — no native bindings   |
| `resend`               | Transactional email API          | Simple API, generous free tier |
| `react-hook-form`      | Form state management            | Zero re-renders on keystroke   |
| `@hookform/resolvers`  | Zod + React Hook Form bridge     | Official integration           |

---

### Step 2 — Prisma Schema

The schema defines 6 new models. Each serves a specific purpose:

#### `User`

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?  // null = not verified
  passwordHash  String?    // null for Google-only accounts
  role          Role       @default(BUSINESS_OWNER)
  deletedAt     DateTime?  // null = active; soft-delete preserves audit history
}
```

- `passwordHash` is nullable because Google OAuth users have no password
- `deletedAt` is a soft delete — hard deleting breaks audit log foreign keys
- `role` defaults to `BUSINESS_OWNER` — the least privileged real user role

#### `Account` (mapped to `oauth_accounts`)

```prisma
model Account {
  provider          String
  providerAccountId String  // Google's user ID
  @@map("oauth_accounts")   // snake_case table, PascalCase model
}
```

Required by PrismaAdapter for OAuth provider account linking.
`@@map` lets us keep snake_case table names while the adapter finds the
model by the name `Account`.

#### `EmailVerificationToken` and `PasswordResetToken`

```prisma
model EmailVerificationToken {
  tokenHash String    @unique  // SHA-256 hash stored; raw token sent in email
  expiresAt DateTime            // expires after 24 hours
  usedAt    DateTime?           // set on use — prevents replay attacks
}
```

**Why `usedAt` instead of deleting the record on use?**
If we deleted the token, a user clicking the email link twice would get a
confusing "token not found" error. With `usedAt` we can return "already used"
— a clear, helpful message. It also makes the audit trail complete.

#### `AuditLog`

```prisma
model AuditLog {
  action      AuditAction  // USER_CREATED, EMAIL_VERIFIED, PASSWORD_RESET...
  entityType  String        // "User"
  entityId    String        // the user's cuid
  actorId     String?       // who performed the action
  ipAddress   String?       // for security review
}
```

Built from day one so every Phase 1 event is traceable. Retroactively adding
audit logs is painful — you miss all historical events.

---

### Step 3 — Environment Variables

```bash
NEXTAUTH_SECRET=<openssl rand -base64 32>  # encrypts JWT cookies
AUTH_URL=http://localhost:3000              # base URL for OAuth callbacks
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

`NEXTAUTH_SECRET` is critical: it is the encryption key for all JWT cookies.
If it changes in production, all existing sessions are invalidated. If it
leaks, anyone can forge a valid session for any user.

**Google OAuth Authorized Redirect URI** (set in Google Cloud Console):
http://localhost:3000/api/v1/auth/callback/google (dev)
https://yourdomain.com/api/v1/auth/callback/google (prod)

text

---

### Step 4 — TypeScript Type Augmentation

```typescript
// src/types/next-auth.d.ts
declare module "next-auth" {
  interface Session {
    user: {
      id: string; // not in DefaultSession — we add it
      role: Role;
      emailVerified: Date | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    emailVerified: Date | null;
  }
}
```

Auth.js's default `Session` type does not include `id`, `role`, or
`emailVerified`. Without this file, TypeScript errors on every
`session.user.id` access throughout the codebase.

**One `declare module "next-auth"` block only.** Two blocks in the same file
causes TypeScript to merge them unpredictably.

---

### Step 5 — Auth.js Configuration

`src/lib/auth.ts` is the single source of truth for all auth behavior.

```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  basePath: "/api/v1/auth",
  pages: { signIn: "/ar/sign-in" },
  providers: [ Google(...), Credentials(...) ],
  callbacks: { signIn, jwt, session }
})
```

#### `basePath: "/api/v1/auth"`

Moves all Auth.js routes under our versioned API path:

- Sign-in: `POST /api/v1/auth/callback/credentials`
- Google callback: `GET /api/v1/auth/callback/google`
- Session: `GET /api/v1/auth/session`

#### Credentials Provider — `authorize()`

```typescript
async authorize(credentials) {
  const parsed = SignInSchema.safeParse(credentials)
  if (!parsed.success) return null        // 1. Validate input shape

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email, deletedAt: null }
  })

  if (!user || !user.passwordHash) return null  // 2. Exists + has password

  const isValid = await verifyPassword(parsed.data.password, user.passwordHash)
  if (!isValid) return null               // 3. Password matches

  return user                             // 4. Auth.js creates the JWT
}
```

**Why `null` for both "user not found" AND "wrong password"?**
Returning different errors leaks information: an attacker can probe which
emails are registered. `null` for both cases prevents this enumeration.

#### `signIn` Callback

```typescript
async signIn({ user, account }) {
  if (account?.provider === "google" && user.id) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() }  // Google guarantees verified emails
    })
  }
  return true
}
```

Google verifies emails before issuing OAuth tokens. We mark the user's email
as verified immediately — no email link required for Google users.

#### `jwt` Callback

```typescript
async jwt({ token, user, account }) {
  if (user) {
    // First sign-in: embed custom fields into the JWT
    token.id = user.id!
    token.role = user.role
    token.emailVerified = user.emailVerified
  }
  if (account?.provider === "google") {
    // jwt() runs before the DB write from signIn() callback completes
    // Set it directly so the token has the correct value immediately
    token.emailVerified = new Date()
  }
  return token
}
```

**Why set `emailVerified` in both `signIn` and `jwt` callbacks?**
The `signIn` callback updates the DB row (persistent fix). The `jwt` callback
sets it in the token (immediate fix for the current session). Without the
`jwt` fix, the user is redirected to `/verify-email` on every Google login
because the token was built before the DB write completed.

#### `session` Callback

```typescript
session({ session, token }) {
  session.user.id = token.id
  session.user.role = token.role
  session.user.emailVerified = token.emailVerified
    ? new Date(token.emailVerified) : null
  return session
}
```

Shapes what `useSession()` and `auth()` return. Without this, `session.user`
only contains `name`, `email`, and `image` — our custom fields are missing.

---

### Step 6 — Route Handler

```typescript
// src/app/api/v1/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

The `[...nextauth]` catch-all captures every Auth.js HTTP endpoint. Two lines
of code — Auth.js handles all the routing internally.

---

### Step 7 — Security Utilities

```typescript
// src/features/auth/utils.ts

// 12 rounds ≈ 300ms — slow enough to deter brute force, fast for users
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

// bcrypt.compare uses constant-time comparison internally
// Prevents timing attacks (measuring response time to count matched chars)
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// 32 bytes = 256 bits of entropy = 1 in 2^256 chance of guessing
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Store SHA-256 hash only — DB breach cannot be used to verify emails
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
```

---

### Step 8 — Rate Limiting

```typescript
// 5 login attempts per 15 minutes per identifier
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  prefix: "rl:auth",
});

// 3 password reset attempts per hour (more restrictive — prevents email flooding)
export const passwordResetRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  prefix: "rl:reset",
});
```

**Why sliding window over fixed window?**
Fixed window: attacker sends 5 requests at 11:59:55, waits 5 seconds, sends
5 more at 12:00:01 — 10 requests in 10 seconds while "within the limit" on
each window boundary.

Sliding window: counts all requests in the last N seconds from NOW. No
boundary exploit is possible.

**Why Upstash Redis?**
Rate limit state must be shared across all server instances. An in-memory
counter resets on every deployment and does not work across multiple servers.

**Two identifiers checked on sign-in:**

- By email → prevents targeting one account from many IPs
- By IP → prevents one IP from trying many different accounts

---

### Step 9 — Zod Schemas

```typescript
export const SignUpSchema = z.object({
  name: z.string().min(2, "validation.nameTooShort").max(100),
  email: z.string().email("validation.invalidEmail"),
  password: z
    .string()
    .min(8, "validation.passwordTooShort")
    .regex(/[A-Z]/, "validation.passwordNeedsUppercase")
    .regex(/[0-9]/, "validation.passwordNeedsNumber"),
});
```

**Error messages are translation keys, not raw strings.**
The message `"validation.nameTooShort"` is looked up via `t(errors.name.message)`
in the component, which returns the correct Arabic or English string. Adding a
third language requires only a new JSON file — zero code changes.

**Schemas are used in two places:**

1. **Client side** — React Hook Form validates on input before submission
2. **Server side** — Server Actions re-validate before any DB operation

Never trust client-side validation alone. A user can bypass browser validation
by sending raw HTTP requests directly to the server.

---

### Step 10 — Audit Logging

```typescript
// src/lib/audit.ts
export function writeAuditLog(params: AuditParams): void {
  prisma.auditLog
    .create({ data: params })
    .catch((err) => console.error("[AuditLog] write failed:", err));
  // No await — fire and forget
}
```

**Why fire-and-forget?**
Audit log failure must never block the main operation. If the log write fails
(DB timeout, network issue), the user should still complete sign-up, verify
their email, or reset their password. Logging is observability — it must not
become a single point of failure.

**Events logged in Phase 1:**
| Event | When |
|---|---|
| `USER_CREATED` | Successful sign-up |
| `EMAIL_VERIFIED` | User clicks verification link |
| `PASSWORD_RESET` | Password successfully changed |
| `USER_DELETED` | Account soft-deleted |

---

### Step 11 — Email Sending

```typescript
export async function sendVerificationEmail(to, name, rawToken) {
  const link = `${APP_URL}/ar/verify-email?token=${rawToken}`;
  await resend.emails.send({ from: FROM, to, subject: "...", html: `...` });
}
```

**The `rawToken` goes in the email — never the `tokenHash`.**

The verification flow:

1. User clicks `?token=abc123raw` in their email
2. `verifyEmailAction("abc123raw")` is called
3. Server computes `SHA-256("abc123raw")` → `"hashedvalue"`
4. `SELECT * FROM EmailVerificationToken WHERE tokenHash = "hashedvalue"`
5. Record found → email verified ✅

If the DB is breached and an attacker gets `"hashedvalue"`, they cannot reverse
SHA-256 to get `"abc123raw"`. The raw token exists only in the user's inbox.

**Why fire-and-forget for email sending?**
Email delivery can take 100–500ms. The user should not wait for a network
call to an external API. The user is already in the DB — if the email fails,
they can request a new verification email (Phase 2 feature).

---

### Step 12 — Server Actions

Server Actions are Next.js App Router's mechanism for running server-side code
called directly from client components, without building a REST endpoint. They
run exclusively on the server — never in the browser.

#### `signUpAction` — Full flow

SignUpSchema.safeParse() → validate input shape and rules

checkRateLimit() → 5 attempts per 15min per IP

prisma.user.findUnique() → check email availability

hashPassword() → bcrypt 12 rounds

prisma.user.create() → write user to DB

generateSecureToken() → 256-bit random raw token

hashToken() → SHA-256 hash

prisma.emailVerificationToken.create() → store hash + expiry

sendVerificationEmail() → fire-and-forget

writeAuditLog() → fire-and-forget

return { success: true } → do NOT sign them in

text

**Why not sign in immediately after sign-up?**
If we signed users in without email verification, anyone could register
`ceo@bigcompany.com` (an email they do not own) and immediately access the
account. Email verification proves control of the inbox.

#### `verifyEmailAction` — Atomicity matters

```typescript
await prisma.$transaction([
  prisma.user.update({ data: { emailVerified: new Date() } }),
  prisma.emailVerificationToken.update({ data: { usedAt: new Date() } }),
]);
```

**Why `$transaction`?** If the first update succeeds but the second fails,
the token could be reused — the DB would have `emailVerified` set but
`usedAt` still null. Wrapping both in a transaction ensures they either both
succeed or both fail (atomicity).

#### `forgotPasswordAction` — Enumeration prevention

```typescript
const user = await prisma.user.findUnique({ where: { email } });

// CRITICAL: same response whether user exists or not
if (!user) return { success: true };

// Only reaches here if user exists
```

An attacker probing for registered emails cannot distinguish between
"email not registered" and "email registered, reset sent" — both return
`{ success: true }` with identical timing.

#### `resetPasswordAction` — Force re-login

```typescript
await prisma.$transaction([
  prisma.user.update({
    data: { passwordHash: await hashPassword(newPassword) },
  }),
  prisma.passwordResetToken.update({ data: { usedAt: new Date() } }),
  prisma.session.deleteMany({ where: { userId: record.userId } }), // force re-login
]);
```

Deleting all sessions for the user means: if their account was compromised and
the attacker is currently logged in, changing the password kicks them out.
Note: with JWT strategy, existing JWT cookies are not immediately invalidated
(they are self-contained). Phase 2 addresses this with `passwordChangedAt`.

#### `deleteAccountAction` — GDPR-safe anonymization

```typescript
prisma.user.update({
  data: {
    deletedAt: new Date(),
    email: `deleted_${userId}@deleted.local`, // PII removed
    name: "Deleted User",
    passwordHash: null,
    image: null,
  },
});
```

**Why anonymize instead of hard-delete?**
Audit logs reference the user's ID via a foreign key. Hard-deleting the user
breaks referential integrity. Anonymization removes all PII (complying with
GDPR "right to be forgotten") while keeping the audit trail intact.

---

### Step 13 — Middleware

```typescript
// src/middleware.ts
const intlMiddleware = createMiddleware(routing);
export default intlMiddleware; // next-intl only — no auth check

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

**Why no auth check in middleware?**

The middleware runs on Vercel's **Edge Runtime** — a lightweight V8 sandbox
without Node.js APIs:

- No Prisma (no DB queries)
- No bcrypt (no native modules)
- No `fs`, `path`, or Node.js built-ins

Auth.js v5 provides an edge-safe `auth()` via the two-file pattern
(`auth.config.ts` + `auth.ts`), but combining it with next-intl's middleware
caused locale detection failures in this project.

**The solution: protect routes in Server Component layouts.**

```typescript
// src/app/[locale]/(dashboard)/layout.tsx — runs in Node.js, full DB access
export default async function DashboardLayout({ ... }) {
  const session = await auth()             // decrypt JWT — no DB query

  if (!session) redirect(`/${locale}/sign-in`)
  if (!session.user.emailVerified) redirect(`/${locale}/verify-email`)

  return <>{children}</>
}
```

Middleware handles routing and locale. Layouts handle authorization for their
route group. Each layer does exactly one job.

---

### Step 14 — Auth Pages (UI)

#### The `signIn()` call — client vs. server

This was the most critical architectural decision of the entire phase.

**❌ Server Action approach (does not work correctly):**

```typescript
export async function signInAction(data) {
  await signIn("credentials", { ...data, redirectTo: "/dashboard" });
}
```

When called from a Server Action, Auth.js can lose the HTTP context needed
to properly set cookies and encode the session.

**✅ Client-side approach (correct):**

```typescript
// In the page component:
const result = await signIn("credentials", {
  email: data.email,
  password: data.password,
  redirect: false,
});
window.location.href = `/${locale}/dashboard`;
```

`signIn()` from `next-auth/react` makes a real HTTP POST to
`/api/v1/auth/callback/credentials`. The route handler runs `authorize()`,
the `jwt` callback builds the token, and `Set-Cookie` is sent in the response.

**Why `window.location.href` instead of `router.push()`?**
`router.push()` is a client-side navigation — it does not send a new request
to the server, so Server Components do not re-read the freshly set cookie.
`window.location.href` triggers a full page load, which sends the cookie to
the server where `auth()` reads it correctly.

#### Direction handling (`dir` attribute)

```html
<!-- Page wrapper: RTL for Arabic content -->
<div dir="rtl">
  <!-- Email input: always LTR — email addresses are latin characters -->
  <input type="email" dir="ltr" />

  <!-- Password input: always LTR — passwords contain latin chars -->
  <input type="password" dir="ltr" />
</div>
```

If email/password inputs render RTL, the `@` symbol and cursor position appear
on the wrong side — confusing for users.

---

### Step 15 — i18n Translation Keys

**Server Actions return translation keys, not translated strings:**

```typescript
// actions.ts:
return { success: false, error: "emailTaken" }

// Page component:
const t = useTranslations("auth")
{serverError && <p>{t(serverError)}</p>}
// Arabic: "هذا البريد الإلكتروني مسجل مسبقاً."
// English: "This email is already registered."
```

**Zod schemas use translation keys as error messages:**

```typescript
// schemas.ts:
z.string().min(2, "validation.nameTooShort")

// Page component:
{errors.name && <p>{t(errors.name.message)}</p>}
```

**Result:** Adding French (`messages/fr.json`) requires zero changes to
schemas, actions, or components. Only the JSON translation file changes.

---

## 6. Critical Bugs Fixed During Implementation

### Bug 1 — `strategy:"database"` + Credentials = session always null

**Symptom:** `authorize()` returned user correctly, but `auth()` in layouts
returned `null`. Users were permanently stuck on sign-in.

**Root cause:** Auth.js v5 beta does not call `adapter.createSession()` for
the Credentials provider. It writes a JWT cookie regardless of the strategy
setting. `auth()` then queries `SELECT FROM Session WHERE token = <jwt>` —
no row exists.

**Fix:** Switch to `strategy: "jwt"`. PrismaAdapter kept for Google OAuth.

---

### Bug 2 — Google sign-in redirected to `/verify-email`

**Symptom:** After successful Google OAuth, user was redirected to
`/verify-email` instead of `/dashboard`.

**Root cause 1:** `jwt()` callback read `user.emailVerified` from the DB
record, which was still `null` because the `signIn()` callback DB write
had not yet completed when `jwt()` ran.

**Root cause 2:** DB row had `emailVerified: null` for all Google users.

**Fix:** Set `token.emailVerified = new Date()` directly in `jwt()` callback
when `account.provider === "google"`. Also update the DB row in `signIn()`
callback for persistence.

---

### Bug 3 — `JWEInvalid: Invalid Compact JWE`

**Symptom:** Console error on every page load after switching from `database`
to `jwt` strategy.

**Root cause:** Old `authjs.session-token` cookie (opaque DB token format) was
still in the browser. Auth.js tried to decrypt it as a JWE and failed.

**Fix:** Manually clear `authjs.session-token`, `authjs.csrf-token`, and
`authjs.callback-url` cookies in DevTools → Application → Cookies. New cookies
will be written in correct JWE format on next sign-in.

---

### Bug 4 — `window is not defined` during SSR

**Symptom:** Build error or runtime error in Server Components that imported
client-only code.

**Root cause:** `window.location.href` called at module level, not inside an
event handler.

**Fix:** Always call `window.location.href` inside `async function onSubmit()`
— never at the top level of the module.

---

## 7. Security Decisions Reference

| Decision                               | Alternative            | Why we chose this                            |
| -------------------------------------- | ---------------------- | -------------------------------------------- |
| bcryptjs 12 rounds                     | MD5, SHA, fewer rounds | ~300ms per hash — impractical to brute force |
| Hash tokens before DB storage          | Store raw token        | DB breach cannot verify/reset emails         |
| Identical response for forgot-password | Return "not found"     | Prevents user enumeration                    |
| Soft delete + anonymization            | Hard delete            | Preserves audit integrity, GDPR compliant    |
| HttpOnly JWT cookie                    | localStorage           | XSS cannot steal the session token           |
| Sliding window rate limit              | Fixed window           | No boundary exploit possible                 |
| Fire-and-forget audit log              | Awaited write          | Audit failure never blocks user operations   |
| Email verification before first login  | Sign in immediately    | Prevents claiming unowned emails             |
| `$transaction` for token+user updates  | Separate updates       | Atomicity prevents partial state             |
| Rate limit by email AND IP             | IP only                | Prevents targeting one account from many IPs |

---

## 8. Phase 1 Done Criteria

- [x] User can sign up → receives verification email → clicks link → email verified
- [x] User can sign in with email/password → session cookie set → dashboard
- [x] User can sign in with Google → `emailVerified` set automatically → dashboard
- [x] User can request password reset → receives email → resets password
- [x] Accessing `/dashboard` without session → redirect to sign-in
- [x] Accessing `/dashboard` with unverified email → redirect to verify-email
- [x] Accessing `/admin` as `BUSINESS_OWNER` → redirect to sign-in
- [x] 5 login attempts → rate limit error returned
- [x] All auth pages render correctly in Arabic (RTL) and English (LTR)
- [x] All user-facing strings live in `messages/ar.json` and `messages/en.json`

---

## 9. What Phase 2 Will Harden

Phase 1 is fully functional but has known limitations:

### 1. JWT revocation on password reset

Currently, changing your password does not invalidate existing JWT cookies on
other devices (because JWTs are self-contained). Phase 2 fixes this:

```typescript
// Add to User model:
passwordChangedAt DateTime?

// Add to jwt() callback in auth.ts:
if (dbUser.passwordChangedAt) {
  const tokenIssuedAt = token.iat as number  // seconds since epoch
  const passwordChanged = dbUser.passwordChangedAt.getTime() / 1000
  if (tokenIssuedAt < passwordChanged) {
    return null  // invalidate — forces re-sign-in
  }
}
```

### 2. Resend verification email

Users who never received (or lost) their verification email currently have no
way to request a new one. Phase 2 adds a "resend verification" action with
its own rate limit (3 per hour per email).

### 3. React Email templates

Current emails are plain HTML strings. Phase 9 replaces them with React Email
components matching the app's visual identity — proper typography, logo,
branded colors, unsubscribe link.

### 4. Admin role assignment UI

Currently, roles can only be changed by direct DB manipulation via Prisma
Studio. Phase 2 adds an admin panel where `SUPER_ADMIN` can promote users to
`ADMIN` through the UI.

### 5. `passwordChangedAt` field

Required for the JWT revocation fix above. Will be added to the Prisma schema
in Phase 2 migration: `passwordChangedAt DateTime?`
