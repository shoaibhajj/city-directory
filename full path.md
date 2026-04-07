# دليل النبك — City Business Directory

> **A permanent reference document.** Before starting any new project, re-read Sections 3, 4, and 5. Before starting any phase of this project, re-read that phase's section. Every decision recorded here has a **WHY** — understanding the WHY is what separates a senior engineer from a junior one.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Philosophy](#2-architecture-philosophy)
3. [Tech Stack — Versions & Decisions](#3-tech-stack--versions--decisions)
4. [How We Planned This Project](#4-how-we-planned-this-project)
5. [Phase 0 — Complete Implementation Guide](#5-phase-0--complete-implementation-guide)
6. [Folder Structure](#6-folder-structure)
7. [Problems We Faced & How We Solved Them](#7-problems-we-faced--how-we-solved-them)
8. [Key Decisions Log (Questions We Discussed)](#8-key-decisions-log-questions-we-discussed)
9. [Commands Reference](#9-commands-reference)
10. [Environment Variables Reference](#10-environment-variables-reference)
11. [What Comes Next](#11-what-comes-next)

---

## 1. Project Overview

**What this project is:**
A public Arabic-first business directory web application for the city of Al Nabik, Syria. Citizens can search for local businesses (pharmacies, clinics, restaurants, etc.), view their contact information, working hours, photos, and videos. Business owners can register their listings. Admins can moderate content.

**The main goals:**

- Allow people to find local business information quickly via search
- Arabic-first UI with English as secondary language
- Freely accessible to all citizens (no login required to browse)
- Business owners can register and manage their own listings
- Admin team verifies business information and moderates content

**URL structure:**

```
/{locale}/{citySlug}/{categorySlug}/{businessSlug}
/ar/al-nabik/pharmacies/saydaliyat-al-shifa
/en/al-nabik/pharmacies/saydaliyat-al-shifa
```

**Launched city:** Al Nabik (expandable to other cities via database — zero code changes)

---

## 2. Architecture Philosophy

### The Three Mental Models Every Engineer Must Internalize

#### Mental Model 1: Three Concentric Circles (Security Boundary)

```
┌─────────────────────────────────────────────────────┐
│  OUTER CIRCLE: Clients                              │
│  Browser (Next.js RSC + Client Components)          │
│  Future: iOS / Android apps via /api/v1/* REST      │
├─────────────────────────────────────────────────────┤
│  MIDDLE CIRCLE: Logic (SECURITY BOUNDARY)           │
│  Next.js Server Actions + API Routes                │
│  ← ONLY these talk to the database                  │
│  ← ONLY these validate permissions                  │
├─────────────────────────────────────────────────────┤
│  INNER CIRCLE: Data                                 │
│  PostgreSQL = single source of truth                │
│  Redis = cache layer for read-heavy operations      │
└─────────────────────────────────────────────────────┘
```

**The rule:** A client component NEVER touches the database directly. Always through the middle circle.
**WHY:** The middle circle is where authorization happens. Bypassing it means bypassing all security checks.

#### Mental Model 2: States, Transitions, and Failure Modes

Before writing any feature, answer three questions:

1. **What are all the states this data can be in?** (e.g., DRAFT → ACTIVE → SUSPENDED)
2. **What are all the valid transitions between those states?**
3. **What happens when this fails halfway through?**

If you can answer all three before writing a single line, you produce production-grade software regardless of experience level.

#### Mental Model 3: Design for Extension, Not for the Future

- Do NOT build multi-city UI now (over-engineering)
- DO build a data model that supports multiple cities (design for extension)
- Difference: one DB row vs rebuilding the whole application

**The rule:** A junior engineer hardcodes the city name in 12 places. A senior puts it in the database once and reads it dynamically. Adding a second city = zero code changes.

### Why Monolith Over Microservices

We chose a **single Next.js application** instead of separate frontend + backend services.

|                 | Monolith (Our Choice)                                             | Microservices                    |
| --------------- | ----------------------------------------------------------------- | -------------------------------- |
| Deployment      | 1 Vercel project                                                  | Multiple services to orchestrate |
| Type safety     | End-to-end TypeScript                                             | API contracts between services   |
| Team size fit   | 1-3 developers                                                    | 5+ developers per service        |
| Debugging       | Single codebase, single logs                                      | Distributed tracing required     |
| When to upgrade | When team > 8 people and services have independent release cycles | Now                              |

**Principle:** Start with the simplest architecture that can scale to your expected load. Premature microservices is one of the most common and expensive mistakes in software engineering.

---

## 3. Tech Stack — Versions & Decisions

### Core Framework

| Package       | Version  | Why This Version                                     | Why Not Something Else                      |
| ------------- | -------- | ---------------------------------------------------- | ------------------------------------------- |
| `next`        | `16.2.1` | Active LTS (supported until Oct 2027), latest stable | Not v15 — would require upgrade in 6 months |
| `react`       | `19.2.4` | Required by Next.js 16                               | —                                           |
| `typescript`  | `5.9.3`  | Ships with Next.js 16                                | —                                           |
| `tailwindcss` | `4.2.2`  | Latest stable v4 — no config file needed             | Not v3 — v4 is the current standard         |

### Package Manager

| Tool   | Version   | Why                                                                              |
| ------ | --------- | -------------------------------------------------------------------------------- |
| `pnpm` | `10.33.0` | 3.4× faster than npm in CI, hardlinks save disk space, zero compatibility issues |

**Why not Bun?** Bun is faster but has occasional compatibility issues with Prisma migration scripts and native Node.js modules. For a learning project, pnpm's zero-surprises track record is more valuable than Bun's speed.

**Why not npm?** 3-minute cold installs vs 30-second pnpm installs. No reason to use npm in 2026.

### Database

| Package          | Version   | Why                            |
| ---------------- | --------- | ------------------------------ |
| `prisma`         | `^6.19.2` | Deliberately NOT v7            |
| `@prisma/client` | `^6.19.2` | Must match CLI version exactly |

**Why Prisma 6 and not 7?**
Prisma 7 (released November 2025) requires **driver adapters** for every database connection. The pattern changes:

- Prisma 6: `new PrismaClient()` — simple, works everywhere
- Prisma 7: `new PrismaClient({ adapter: new PgAdapter(pool) })` — more control, more setup

For a learning project, Prisma 6 is the right choice:

- All documentation online references v6 patterns
- Zero breaking changes to navigate
- Battle-tested with millions of production deployments

**Upgrade path when ready:** `prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7`

**IMPORTANT:** Always run Prisma CLI with `pnpm exec prisma` — NEVER with `pnpx prisma`.

- `pnpm exec prisma` = uses YOUR installed version (6.x) from node_modules ✅
- `pnpx prisma` = downloads LATEST from internet (would get v7) ❌

### Authentication

| Package     | Version     | Why                                  |
| ----------- | ----------- | ------------------------------------ |
| `next-auth` | `beta` (v5) | Standard for Next.js App Router auth |

**Why Auth.js v5 over building from scratch?**
Auth handles: CSRF tokens, session rotation, OAuth state parameters, secure cookie settings, token refresh. Getting any one of these wrong creates a security vulnerability. The beta has been production-stable since mid-2024 and is used by thousands of production apps.

**Session strategy: `"database"` not JWT**

- Database sessions: stored in PostgreSQL, can be instantly revoked (user reports theft → delete session row → they're logged out immediately)
- JWT sessions: stored in browser, cannot be revoked until they expire

### i18n

| Package     | Version | Why                                       |
| ----------- | ------- | ----------------------------------------- |
| `next-intl` | `3.x`   | Best-in-class i18n for Next.js App Router |

**Why locale-prefix 'always'?**

- `/ar/...` and `/en/...` — every URL has explicit locale
- Alternative 'as-needed' omits prefix for default locale (`/` instead of `/ar/`)
- 'always' is better for: SEO (Google indexes languages separately), sharing URLs (recipient sees the exact language), analytics (easy to filter by locale)

### UI Components

| Package     | Version      | Why                                                                 |
| ----------- | ------------ | ------------------------------------------------------------------- |
| `shadcn/ui` | `4.x`        | Copies component source into your project — you own the code        |
| Radix UI    | (via shadcn) | Mature (4+ years), accessibility-first, huge ecosystem              |
| Preset      | Nova         | Compact and clean — works for both directory cards and admin tables |

**Why shadcn over Material UI or Chakra?**
shadcn installs component SOURCE CODE into your project. You can modify any button without fighting a library's internals. For a custom Arabic-language platform where RTL behavior matters, this ownership is critical.

**Why Radix over Base UI?**
Base UI hit v1.0 in December 2025. Radix has 4 years of bug fixes, battle-tested accessibility, and all tutorials online reference it. Base UI is promising — revisit for future projects in 2027.

### Search

**Technology: `pg_trgm` PostgreSQL extension with GIN index**

| Option                  | Arabic Stemming             | Partial Match | Typo Tolerance | Complexity              |
| ----------------------- | --------------------------- | ------------- | -------------- | ----------------------- |
| `tsvector` (Full-Text)  | Poor (no Arabic dictionary) | ✅            | ❌             | Medium                  |
| **`pg_trgm` (Trigram)** | N/A (works char-by-char)    | ✅            | ✅             | Low                     |
| MeiliSearch             | ✅ Excellent                | ✅            | ✅             | High (separate service) |

**Decision: `pg_trgm`** — no extra service, no extra cost, works character-by-character so Arabic is handled perfectly, typo tolerance is free.

**Minimum search query: 2 characters** — enforced both client and server side. Single-character searches on a trigram index are slow and return too many results.

**Upgrade path:** When listings exceed 100,000, migrate to MeiliSearch. The `searchable_text` column is already designed for this migration.

### Infrastructure

| Service    | Free Tier        | Why                                                                 |
| ---------- | ---------------- | ------------------------------------------------------------------- |
| Vercel     | Generous         | Zero-config Next.js deployment, edge CDN, ISR support               |
| Neon       | 3GB storage      | Serverless PostgreSQL — scales to zero, connection pooling built-in |
| Upstash    | 10k commands/day | Serverless Redis — HTTP-based (works in Vercel Edge Runtime)        |
| Cloudinary | 25GB storage     | Image transformation, CDN delivery, video storage                   |
| Resend     | 100 emails/day   | Transactional email with React templates                            |

**Why Upstash over a self-hosted Redis?**
Vercel's serverless functions are stateless — they cannot maintain persistent TCP connections. Upstash uses HTTP requests instead of TCP, making it the only Redis option that works correctly in Vercel's environment.

---

## 4. How We Planned This Project

### The Planning Process — How a Senior Engineer Thinks

**Step 1: Define the problem before writing code**

We started with clarifying questions across 10 dimensions:

1. Content moderation (auto-approve vs manual review)
2. Geographic scope (single city, expandable)
3. Media hosting budget
4. Search requirements (Arabic, partial match)
5. Business verification system
6. PDF rendering engine
7. OAuth providers
8. Languages at launch
9. Default pagination
10. Video content limits

**WHY ask these questions first?** Every unanswered question is a decision made by default — usually the wrong default. Five minutes of clarification prevents five days of rework.

**Step 2: Document decisions as Architecture Decision Records (ADRs)**

Every significant technical decision is documented with:

- **Context:** What was the situation?
- **Decision:** What did we choose?
- **Rationale:** WHY this and not something else?
- **Consequences:** What does this decision prevent or enable?

This creates institutional memory. When you return to this project in 6 months, you understand not just what was built but why.

**Step 3: Design the data model before any UI**

We designed the complete PostgreSQL schema before writing a single React component. The data model is the foundation — if it's wrong, everything built on top of it is wrong.

**Step 4: Define phases as vertical slices**

Each phase delivers **working, shippable software** — not half-finished features. Each phase's output is something you can demo and test end-to-end.

Bad approach (horizontal slices): "Phase 1: All database tables. Phase 2: All API routes. Phase 3: All UI."
Good approach (vertical slices): "Phase 1: Auth (complete flow from signup to signout). Phase 2: Domain models. Phase 3: Category CMS (admin can create categories end-to-end)."

### The 12 Implementation Phases

| Phase | What Gets Built                        | Key Principle Demonstrated                                                                  |
| ----- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| 0     | Project setup, tooling, infrastructure | "A properly configured project saves 100 hours of debugging"                                |
| 1     | Complete authentication system         | "Security is the bedrock — nothing else is built without knowing WHO is making the request" |
| 2     | Database models + pg_trgm search       | "The schema is the single source of truth"                                                  |
| 3     | Category CMS                           | "Never hardcode content a non-developer might need to change"                               |
| 4     | Business profile + owner dashboard     | "The core value unit of the application"                                                    |
| 5     | Media upload system                    | "Magic bytes validation — never trust file extensions"                                      |
| 6     | Public directory + search              | "URL state = shareable, bookmarkable, SEO-indexable"                                        |
| 7     | Admin panel                            | "Observability — you can't manage what you can't see"                                       |
| 8     | PDF export                             | "Caching strategy — never regenerate what hasn't changed"                                   |
| 9     | Notifications + emails                 | "Every transactional event needs a paper trail"                                             |
| 10    | SEO + performance                      | "You don't know what's slow until you measure it"                                           |
| 11    | Testing                                | "Test the contracts, not the implementation"                                                |
| 12    | CI/CD + deployment                     | "Automate everything that can be automated"                                                 |

---

## complete Describtion for Each Phase

🧩 Implementation Phases (Final Roadmap)
Here is the full `README.md` with all the original information, just properly structured and formatted: [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/156743553/6978c719-7bcd-40fa-b150-98a9eaf29db1/paste.txt?AWSAccessKeyId=ASIA2F3EMEYETI7GMCTB&Signature=rXL5T15eEPmIRoCbg3VLXtP%2F%2FtE%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEJ3%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIQCGSK%2FbgQDvEvNq4fMLDf51vpdyD7yniDO9HzVoTpBjWAIgV8ylGDthWTDs%2BGsc8Bf3JyX8usXRLLtPBYB7u%2BVftuEq8wQIZRABGgw2OTk3NTMzMDk3MDUiDNnYhvUj1juS6WgjgirQBEf4u4b6TtqpTyEdGJJEoUTQgnAD%2FttPE5rgzdXsXCbZnYWtaPo3D0TK4TFarDJfgtjYq0A2rn8IkEuoATNoQruJ4s6QGJe0EabD6VrdV3OE6Cml9JqgTXAnFIA%2F7OPDQoTmcAAjko8QembYAG%2B1Jw9p8dO6h%2BiyCXQr0by2jMiQRb38wFjVrwkb1OR2dIaThv%2Fy1qeCnUtZ3hItUacT5tsSZMXOV%2BcdgVOO8JdRlCV7g3bUd9OnXYx4QjZRBsdtDYd80GhpRSrH%2Bc71enSzWwjvpO9okGliGgxNf%2FcMbj6JIrVq6wTcNG1%2FMYGctvR%2BjJEqsAr8BI3KPWcKGChAyF5VIVQ3IiutGfdNpDWHkdsbC0W%2FswHpUAiSyoGymMKav9nIZYD5sXQEKKCMrxuIpcw9lIhPBONFvxyLmJHNw3YzL7MUdSQNiyNKQ4QGY6AAv%2BMo6UCO1uT0RM0DWl1JPkRHlMQ6mupXq%2BiIqxiehGUZ%2FWb%2Bjaq5yEQHsarMq96NipD%2F0fZFcfrII7HipKyrTr1ooFzWyQ9MU6aL6WWl5V4pueHV9agdAjemfLhisZG7iEYIC6ncSRf42L5z6pW9bSYZ11TlS5pEog5MfGmepIFF4ya3zPvymoAh8rlAeJTQ34sdsGr1Uze6plZjxzyesxM0Pg5F4HB8GcAaoHFW%2FMNGQPQt5dR4KP7zA%2Bjg5KS5l6Hwn7jbPjK7oeAioQAwj74DrPZOyq21N0cpQBDZh88YIIKINglxkDEMm8gGFsq8ytqBKiicNPw5nD4VKmd5UgIwkNa3zgY6mAG5qjDt7JXWbmfQ2WDt1VifqKSPP53jaVDni12MCl3C1bMKgx6%2FU6NAAeSCnjypVtb8qmpv%2BN0KS%2BXCTiypYRhpP8uEoCAzeJa5M%2BvqhddYSJBC7AeeN3PL8qUkcroWZmkYU9lpiduKwsQqfQEIeAW%2FxKgp9EqU2rb5WOZJNIpsknVcG95nBBXV8lSWDoBgx6VimzIhG%2FpWzg%3D%3D&Expires=1775104020)

---

````markdown
# City Directory — Implementation Blueprint

A phased engineering plan for building a bilingual (Arabic/English) city business directory with Next.js 15, PostgreSQL, Redis, and Auth.js v5.

---

## Table of Contents

- [Phase 0: Project Setup & Infrastructure](#phase-0-project-setup--infrastructure)
- [Phase 1: Authentication System](#phase-1-authentication-system)
- [Phase 2: Database & Prisma Setup](#phase-2-database--prisma-setup)
- [Phase 3: Category & CMS System](#phase-3-category--cms-system)
- [Phase 4: Business Profile & Dashboard](#phase-4-business-profile--dashboard)
- [Phase 5: Media Upload System](#phase-5-media-upload-system)
- [Phase 6: Public Directory (Browse / Search / Filter)](#phase-6-public-directory-browse--search--filter)
- [Phase 7: Admin Panel](#phase-7-admin-panel)
- [Phase 8: PDF Export](#phase-8-pdf-export)
- [Phase 9: Notifications & Emails](#phase-9-notifications--emails)
- [Phase 10: SEO & Performance Optimization](#phase-10-seo--performance-optimization)
- [Phase 11: Testing & QA](#phase-11-testing--qa)
- [Phase 12: Deployment & CI/CD](#phase-12-deployment--cicd)
- [Phase 13: Mobile API Layer (Future-Proofing)](#phase-13-mobile-api-layer-future-proofing)
- [Risk Assessment](#risk-assessment)
- [Final Senior Advice](#final-senior-advice)

---

## Phase 0: Project Setup & Infrastructure

**Complexity:** Low | **Estimated Time:** 2–3 days | **Dependencies:** None

**Goal:** Any developer clones this repo, runs two commands, and has a fully working local environment. Zero ambiguity.

**WHY this phase matters:** Professional teams lose days to "it works on my machine" problems. A properly configured Phase 0 means your future self — and any team member who joins — can start contributing in under 30 minutes. This is the foundation everything else sits on.

---

### Repository & Tooling Setup

- Create GitHub repository with `main` as default branch
- Initialize Next.js 15:
  ```bash
  npx create-next-app@latest city-directory --typescript --tailwind --app --src-dir --import-alias "@/*"
  ```
- Install and configure shadcn/ui:
  ```bash
  npx shadcn@latest init
  ```
  _(select New York style, CSS variables enabled)_
- Configure `tsconfig.json`: ensure `"strict": true` is set. Never disable strict mode — it catches real bugs at compile time, not runtime
- Configure ESLint: extend `eslint-config-next`, add `@typescript-eslint/recommended`, add rule `no-console: "warn"` (you want to know when `console.log` leaks into production)
- Configure Prettier: `printWidth: 100`, `singleQuote: true`, `semi: false`, `trailingComma: "es5"`
- Create `.prettierrc` and `.eslintrc.json` at root

---

### Git Hooks (Code Quality Gates)

- Install Husky:
  ```bash
  npm install --save-dev husky lint-staged
  npx husky init
  ```
- Configure `.husky/pre-commit`: runs lint-staged (lints + formats only changed files — not the whole project, which would be slow)
- Configure `.husky/commit-msg`: enforces conventional commits via `@commitlint/config-conventional`
- Configure `lint-staged` in `package.json`:

  ```json
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
  ```

> **WHY conventional commits?** `feat:`, `fix:`, `chore:` prefixes enable auto-generated changelogs and semantic versioning later. More importantly, it forces you to think clearly about what a commit actually does.

---

### Local Development Environment

- Create `docker-compose.yml` with PostgreSQL 16 + Redis 7:

  ```yaml
  # File: docker-compose.yml (root of project)
  services:
    postgres:
      image: postgres:16-alpine
      environment:
        POSTGRES_DB: city_directory_dev
        POSTGRES_USER: devuser
        POSTGRES_PASSWORD: devpassword
      ports:
        - "5432:5432"
      volumes:
        - postgres_data:/var/lib/postgresql/data

    redis:
      image: redis:7-alpine
      ports:
        - "6379:6379"

  volumes:
    postgres_data:
  ```

- Create `.env.example` with every variable documented. This file **IS** committed to Git. The values are fake:

  ```bash
  # .env.example — Committed to Git. Document every variable here.

  # Database (Neon.tech or local Docker)
  DATABASE_URL="postgresql://devuser:devpassword@localhost:5432/city_directory_dev"
  DIRECT_DATABASE_URL="postgresql://devuser:devpassword@localhost:5432/city_directory_dev"

  # Auth.js v5
  AUTH_SECRET="generate-with: openssl rand -base64 32"
  AUTH_URL="http://localhost:3000"

  # Google OAuth
  GOOGLE_CLIENT_ID="get-from-console.developers.google.com"
  GOOGLE_CLIENT_SECRET="get-from-console.developers.google.com"

  # Upstash Redis
  UPSTASH_REDIS_REST_URL="get-from-upstash.com"
  UPSTASH_REDIS_REST_TOKEN="get-from-upstash.com"

  # Cloudinary
  CLOUDINARY_CLOUD_NAME="your-cloud-name"
  CLOUDINARY_API_KEY="your-api-key"
  CLOUDINARY_API_SECRET="your-api-secret"

  # Resend (email)
  RESEND_API_KEY="get-from-resend.com"
  RESEND_FROM_EMAIL="noreply@yourdomain.com"

  # Sentry (error tracking) — optional at dev
  NEXT_PUBLIC_SENTRY_DSN=""

  # PostHog (analytics) — optional at dev
  NEXT_PUBLIC_POSTHOG_KEY=""
  NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"

  # App URL
  NEXT_PUBLIC_APP_URL="http://localhost:3000"
  ```

- Create `.env.local` (gitignored) with real local values copied from `.env.example`
- Add `.env.local` to `.gitignore` — verify it's there before your first commit. One accidental secret push to GitHub = security incident.

---

### Environment Variable Validation

Create `src/env.ts` — This is one of the most important files in the project:

```typescript
// src/env.ts
// This file runs at build time and crashes the build if any required
// environment variable is missing. You find out in CI, not in production.
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
  RESEND_API_KEY: z.string(),
  RESEND_FROM_EMAIL: z.string().email(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

---

### Prisma Setup

- Install Prisma:
  ```bash
  npm install prisma @prisma/client
  npx prisma init
  ```
- Replace `prisma/schema.prisma` content with the full schema from Section 3 of this document
- Create `src/lib/prisma.ts` singleton:

  ```typescript
  // src/lib/prisma.ts
  // WHY singleton? Next.js dev mode hot-reloads modules.
  // Without this, each reload creates a new DB connection
  // until you hit PostgreSQL's connection limit.
  import { PrismaClient } from "@prisma/client";

  const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
  };

  export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
  ```

---

### i18n Setup

- Install next-intl:
  ```bash
  npm install next-intl
  ```
- Create `src/i18n/routing.ts`:

  ```typescript
  // src/i18n/routing.ts
  import { defineRouting } from "next-intl/routing";

  export const routing = defineRouting({
    locales: ["ar", "en"],
    defaultLocale: "ar",
    localePrefix: "always",
  });
  ```

- Create `src/i18n/messages/ar.json` and `en.json` with placeholder keys
- Wrap `src/app/[locale]/layout.tsx` with next-intl's `NextIntlClientProvider`
- Configure `next.config.ts` with `createNextIntlPlugin`

---

### Infrastructure Clients

- Create `src/lib/redis.ts` — Upstash Redis client
- Create `src/lib/api-response.ts` — `buildSuccess<T>()` and `buildError()` helpers
- Create `src/lib/error-codes.ts` — centralized error code enum
- Create `src/lib/constants.ts` — all magic numbers in one place

---

### Documentation

- Create `docs/RFC-001-architecture.md` — copy this document
- Create `docs/decisions/ADR-001-monolith.md`, `ADR-002-pg-trgm.md`, `ADR-003-auto-approve.md`
- Write `README.md` with: project overview, prerequisites, setup steps:
  ```
  docker compose up -d → cp .env.example .env.local → npm install → npx prisma migrate dev → npm run dev
  ```

---

### CI/CD Setup

- Create `.github/workflows/ci.yml`:

  ```yaml
  # .github/workflows/ci.yml
  name: CI
  on:
    pull_request:
      branches: [main]
  jobs:
    quality:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: "20", cache: "npm" }
        - run: npm ci
        - run: npm run lint
        - run: npm run type-check # Add to package.json: "tsc --noEmit"
        - run: npm run build
  ```

- Connect repository to Vercel: install Vercel GitHub App, import project, set environment variables in Vercel dashboard
- Verify: push a branch, open a PR, watch CI run green

---

### ✅ Phase 0 Done Criteria

- [ ] `docker compose up -d` starts Postgres + Redis
- [ ] `npm run dev` starts the app at localhost:3000 with no errors
- [ ] `npm run lint` and `npm run type-check` pass with zero errors
- [ ] Pushing a PR triggers the CI workflow and it goes green
- [ ] A new developer can follow only the README and be running in < 30 minutes

---

## Phase 1: Authentication System

**Complexity:** Medium | **Estimated Time:** 4–5 days | **Dependencies:** Phase 0

**Goal:** A user can sign up, verify their email, sign in, reset their password, and sign out. The session is securely stored. All auth routes are rate-limited.

**WHY before anything else?** Every other feature requires knowing WHO is making the request. You cannot build dashboards, listings, or admin tools without a working identity system. Auth is the bedrock.

**WHY Auth.js v5 over building it yourself?** Auth is one of the most security-sensitive parts of any application. Auth.js is maintained by a dedicated team, handles CSRF, session rotation, OAuth flows, and cookie security correctly out of the box. A junior engineer building auth from scratch will almost certainly miss one of these. Use the battle-tested library.

---

### Auth.js Configuration

- Install:
  ```bash
  npm install next-auth@beta @auth/prisma-adapter
  ```
- Run the initial Prisma migration to create `User`, `Session`, `OAuthAccount` tables:
  ```bash
  npx prisma migrate dev --name init_auth
  ```
- Create `src/lib/auth.ts` — full Auth.js v5 configuration:
  - Prisma adapter pointing to your DB
  - Credentials provider (email + password)
  - Google OAuth provider
  - Session strategy: `"database"` (not JWT — allows instant revocation)
  - Callbacks: session callback must attach `user.id` and `user.role` to the session object
  - `pages` config: redirect to `/ar/sign-in` for custom sign-in page

- Augment the TypeScript session type in `src/types/next-auth.d.ts`:

  ```typescript
  // src/types/next-auth.d.ts
  import { Role } from "@prisma/client";
  import { DefaultSession } from "next-auth";

  declare module "next-auth" {
    interface Session {
      user: {
        id: string;
        role: Role;
        emailVerified: Date | null;
      } & DefaultSession["user"];
    }
  }
  ```

- Create `src/app/api/v1/auth/[...nextauth]/route.ts` — Auth.js route handler

---

### Middleware (Route Protection)

Create `src/middleware.ts`. This is a critical file — it runs on EVERY request at the edge before any page renders:

```typescript
// src/middleware.ts
// IMPORTANT: This runs on Vercel's Edge Runtime — no Node.js APIs, no Prisma.
// It can only read the session token from the cookie, not query the DB.
// Full authorization (ownership checks) must ALWAYS happen in Server Actions.
import { auth } from "@/lib/auth";
import { routing } from "@/i18n/routing";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const pathname = nextUrl.pathname;

  // Strip locale prefix for route matching
  const pathnameWithoutLocale = pathname.replace(/^\/(ar|en)/, "");

  // Protected: dashboard routes require any authenticated user
  if (pathnameWithoutLocale.startsWith("/dashboard")) {
    if (!session) {
      return NextResponse.redirect(new URL("/ar/sign-in", req.url));
    }
    if (!session.user.emailVerified) {
      return NextResponse.redirect(new URL("/ar/verify-email", req.url));
    }
  }

  // Protected: admin routes require ADMIN or SUPER_ADMIN
  if (pathnameWithoutLocale.startsWith("/admin")) {
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.redirect(new URL("/ar/sign-in", req.url));
    }
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

### Security Infrastructure

- Create `src/lib/rate-limit.ts` using Upstash Redis sliding window algorithm. This will be called by auth endpoints to prevent brute force attacks
- Create `src/features/auth/utils.ts`:
  - `hashPassword(plain: string): Promise<string>` — bcrypt, 12 rounds
  - `verifyPassword(plain: string, hash: string): Promise<boolean>` — bcrypt compare
  - `generateSecureToken(): string` — 32-byte cryptographically random hex string (using `crypto.randomBytes`)
  - `hashToken(token: string): string` — SHA-256 hash (stored in DB, raw token sent in email)

---

### Server Actions (The business logic layer)

**Create `src/features/auth/schemas.ts`** — Zod schemas:

- `SignUpSchema`: email (valid format), password (min 8 chars, 1 uppercase, 1 number), name (min 2 chars)
- `SignInSchema`: email + password
- `ForgotPasswordSchema`: email
- `ResetPasswordSchema`: token + newPassword + confirmPassword (must match)

**Create `src/features/auth/actions.ts`** — Server Actions:

**`signUpAction(data)`:**

1. Validate with `SignUpSchema`
2. Check email not already registered
3. Hash password
4. Create `User` in DB
5. Generate email verification token → hash → store in `EmailVerificationToken`
6. Send verification email via Resend (async, non-blocking)
7. Return success (do NOT sign them in yet — force email verification first)

**`verifyEmailAction(rawToken)`:**

1. Hash the received token
2. Find matching `EmailVerificationToken` where `tokenHash` matches + not expired + not used
3. Set `user.emailVerified = now()`
4. Set `token.usedAt = now()` (prevents token reuse)
5. Write audit log

**`forgotPasswordAction(email)`:**

1. Find user by email (if not found, return identical success response — prevents user enumeration attacks)
2. Generate token → hash → store with 1-hour expiry
3. Send reset email

**`resetPasswordAction(rawToken, newPassword)`:**

1. Hash the token, find it in DB, verify not expired, not used
2. Hash new password
3. Update `user.passwordHash`
4. Set `token.usedAt = now()`
5. Delete ALL sessions for this user (force re-login on all devices)
6. Write audit log

**`deleteAccountAction()`:**

1. Get current session (verify authenticated)
2. Set `user.deletedAt = now()`
3. Delete all sessions (force sign out)
4. Anonymize: set `user.email = "deleted_[id]@deleted.local"`, `user.name = "Deleted User"`
5. Write audit log

---

### Auth Pages (UI)

- `src/app/[locale]/(auth)/sign-up/page.tsx` — form with React Hook Form + Zod
- `src/app/[locale]/(auth)/sign-in/page.tsx` — credentials + Google OAuth button
- `src/app/[locale]/(auth)/forgot-password/page.tsx`
- `src/app/[locale]/(auth)/reset-password/page.tsx` — reads `?token=` from URL
- `src/app/[locale]/(auth)/verify-email/page.tsx` — reads `?token=` from URL, calls `verifyEmailAction`

---

### ✅ Phase 1 Done Criteria

- [ ] User can sign up → receives verification email → clicks link → email verified
- [ ] User can sign in → session cookie set → redirected to dashboard
- [ ] User can reset password via email → all other sessions invalidated
- [ ] Accessing `/dashboard` without session → redirect to sign-in
- [ ] Accessing `/admin` as `BUSINESS_OWNER` → redirect to sign-in
- [ ] Brute force 6 login attempts → rate limit error returned

---

## Phase 2: Database & Prisma Setup

**Complexity:** Medium | **Estimated Time:** 3–4 days | **Dependencies:** Phase 0, Phase 1

**Goal:** All database tables exist, all indexes are in place, the `pg_trgm` search extension is active, and seed data is ready for development.

**WHY a dedicated phase for this?** Running all migrations in one go at the start seems efficient, but it couples your schema to features that aren't built yet. In practice, we do it in order: auth tables in Phase 1, all remaining tables here in Phase 2, so migrations are always in sync with the code that needs them.

---

### Remaining Models Migration

- Add all remaining models to `prisma/schema.prisma`: `Country`, `Region`, `City`, `Category`, `Subcategory`, `BusinessProfile`, `PhoneNumber`, `WorkingHours`, `SocialLink`, `MediaFile`, `ReviewFlag`, `AuditLog`, `Notification`, `PlatformSetting`
- Run:
  ```bash
  npx prisma migrate dev --name add_all_domain_models
  ```
- Verify in your DB client (TablePlus or pgAdmin) that all tables were created correctly

---

### PostgreSQL Extensions (via Raw Migration SQL)

- Create a manual migration file:
  ```bash
  npx prisma migrate dev --name add_search_extensions --create-only
  ```
- Edit the generated empty `.sql` file to add:

  ```sql
  -- Enable trigram similarity extension for Arabic search
  -- This is what makes ILIKE '%محمد%' fast even on 100,000 rows
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  -- Enable unaccent for diacritic-insensitive search
  -- "محمّد" matches "محمد" with this enabled
  CREATE EXTENSION IF NOT EXISTS unaccent;

  -- GIN (Generalized Inverted Index) on the searchable text column
  -- GIN is optimized for text search, much faster than B-tree for LIKE queries
  -- WHY GIN over GiST? GIN: faster reads, slower writes. GiST: faster writes, slower reads.
  -- A directory has far more reads than writes → GIN is correct.
  CREATE INDEX IF NOT EXISTS idx_bp_search_gin
    ON business_profiles
    USING GIN (searchable_text gin_trgm_ops);

  -- Also index the name directly for name-only searches
  CREATE INDEX IF NOT EXISTS idx_bp_name_ar_gin
    ON business_profiles
    USING GIN (name_ar gin_trgm_ops);
  ```

- Run `npx prisma migrate dev` to apply

---

### Audit Log Helper

Create `src/lib/audit.ts`:

```typescript
// src/lib/audit.ts
// Call this function after EVERY admin or owner action that modifies data.
// WHY: If a listing disappears and the owner complains, you can show exactly
// who changed what and when. This is essential for any multi-user system.
import { prisma } from "@/lib/prisma";
import { AuditAction, Role } from "@prisma/client";

interface AuditParams {
  actorId: string | null;
  actorEmail: string | null;
  actorRole: Role | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
}

export async function writeAuditLog(params: AuditParams) {
  // Fire-and-forget: audit logging should NEVER block the main operation
  // If audit logging fails, the main action still succeeds
  prisma.auditLog.create({ data: params }).catch((err) => {
    console.error("Audit log write failed:", err);
    // In production, this would also alert Sentry
  });
}
```

---

### Platform Settings Reader with Caching

Create `src/features/platform/settings.ts`:

```typescript
// src/features/platform/settings.ts
// WHY cache in Redis? PlatformSetting is read on almost every request
// (listing creation checks max_listings_per_owner, uploads check max_photos, etc.)
// Without caching, every request hits the DB just to read a handful of values.
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const CACHE_TTL = 300; // 5 minutes

export async function getSetting(key: string): Promise<string | null> {
  const cacheKey = `setting:${key}`;

  // Check Redis cache first
  const cached = await redis.get<string>(cacheKey);
  if (cached !== null) return cached;

  // Cache miss: read from DB
  const setting = await prisma.platformSetting.findUnique({ where: { key } });
  if (!setting) return null;

  // Store in Redis with TTL
  await redis.setex(cacheKey, CACHE_TTL, setting.value);
  return setting.value;
}

export async function getSettingNumber(
  key: string,
  fallback: number,
): Promise<number> {
  const value = await getSetting(key);
  return value ? parseInt(value, 10) : fallback;
}
```

---

### Seed Data

Create `prisma/seed.ts` with:

- Syria → Damascus Countryside Region → Al Nabik City (slug: `al-nabik`)
- 10 categories in Arabic + English: `صيدليات` (pharmacies), `عيادات` (clinics), `مطاعم` (restaurants), `محلات بقالة` (groceries), `ورش ميكانيك` (auto-repair), `مخابز` (bakeries), `صالونات` (salons), `محلات ملابس` (clothing), `أدوات بناء` (building-materials), `خدمات متنوعة` (general-services)
- 1 Super Admin user: `admin@city-directory.local` / `Admin@123456`
- Default `PlatformSetting` rows: `max_photos=10`, `max_videos=3`, `max_listings_per_owner=3`, `max_video_size_mb=100`, `max_video_duration_seconds=300`, `pdf_cache_ttl_seconds=21600`, `listing_rate_limit_per_day=1`

Add seed script to `package.json`:

```json
"prisma:seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
```

Run:

```bash
npx prisma db seed
```

---

### ✅ Phase 2 Done Criteria

- [ ] `npx prisma studio` shows all tables populated with seed data
- [ ] `pg_trgm` extension is active (verify with `SELECT * FROM pg_extension WHERE extname = 'pg_trgm'`)
- [ ] GIN index exists on `business_profiles.searchable_text`
- [ ] `getSetting("max_photos_per_listing")` returns `"10"` from Redis on the second call

---

## Phase 3: Category & CMS System

**Complexity:** Low | **Estimated Time:** 2–3 days | **Dependencies:** Phase 0, Phase 1, Phase 2

**Goal:** Super Admin can create, edit, reorder, and toggle visibility of categories and subcategories at runtime — no code deploy needed.

**WHY database-driven categories?** A junior engineer might define categories as a TypeScript enum or a hardcoded array. That works until the admin says "I want to add a new category for gyms." With an enum, you redeploy the whole application. With database-driven categories, the admin clicks a button in the UI. Never hardcode content that a non-developer might need to change.

---

### API Routes

- `GET /api/v1/categories` — public, Redis-cached 10 minutes. Returns all visible categories + their subcategories
- `POST /api/v1/categories` — Super Admin only. Validates with Zod schema, creates record, invalidates Redis cache, writes audit log
- `PATCH /api/v1/categories/:id` — Super Admin only. Update, invalidate cache, audit log
- `DELETE /api/v1/categories/:id` — Super Admin only. Block delete if any ACTIVE listings exist in this category (data integrity)
- `POST /api/v1/categories/reorder` — Super Admin only. Accepts `[{ id, displayOrder }]` array, runs bulk update in a Prisma transaction
- Same CRUD for subcategories nested under their parent

---

### Server Actions

- Create `src/features/categories/actions.ts`: `createCategory`, `updateCategory`, `deleteCategory`, `reorderCategories`
- Create `src/features/categories/queries.ts`: `getAllCategories` (with Redis cache), `getCategoryBySlug`, `getCategoryWithSubcategories`
- Create `src/features/categories/schemas.ts`: `CreateCategorySchema` with Zod — both `nameAr` and `nameEn` required, slug auto-generated from `nameEn` if not provided

---

### Admin UI

`src/app/[locale]/(admin)/admin/categories/page.tsx` — Server Component that fetches all categories. Renders:

- Drag-to-reorder list using `@dnd-kit/sortable`:
  ```bash
  npm install @dnd-kit/core @dnd-kit/sortable
  ```
- Each row: icon + Arabic name + English name + visibility toggle + Edit + Delete buttons
- "Add Category" button opens a modal with the create form
- Subcategory expand/collapse per category
- Category create/edit form: `nameAr`, `nameEn`, `slug` (auto-filled from `nameEn`, editable), icon picker, `isVisible` toggle, `descriptionAr`, `descriptionEn`

---

### Public API Response Cache

- When any category is created/updated/deleted, call: `redis.del("categories:all")`
- `getAllCategories()` query: check `categories:all` key first, fall back to DB if miss, set with 10-minute TTL

---

### ✅ Phase 3 Done Criteria

- [ ] Super Admin can create a new category and it appears on the homepage immediately
- [ ] Dragging categories into a new order and saving persists the order
- [ ] Deleting a category that has listings returns a clear error message
- [ ] `GET /api/v1/categories` returns a cached response on the second call (verify via Redis CLI: `GET categories:all`)

---

## Phase 4: Business Profile & Dashboard

**Complexity:** High | **Estimated Time:** 7–10 days | **Dependencies:** Phase 0–3

**Goal:** A business owner can register their listing, fill all profile fields, publish it (auto-approve → ACTIVE), and manage it from their dashboard.

**WHY the most complex phase?** The business profile is the core value unit of the entire application. It has the most fields, the most validation rules, the most relationships, and the most state transitions. Take your time here — bugs in this phase affect every user.

---

### Listing State Machine

Create `src/features/business/utils.ts` — implement state machine helper:

```typescript
// Valid transitions:
// DRAFT → ACTIVE (owner submits)
// ACTIVE → SUSPENDED (admin action)
// SUSPENDED → ACTIVE (admin restores)
// ACTIVE → DRAFT (not allowed — prevents accidental de-listing)
export function canTransitionTo(
  current: ListingStatus,
  next: ListingStatus,
): boolean {
  const transitions: Record<ListingStatus, ListingStatus[]> = {
    DRAFT: ["ACTIVE"],
    ACTIVE: ["SUSPENDED"],
    SUSPENDED: ["ACTIVE"],
  };
  return transitions[current]?.includes(next) ?? false;
}
```

---

### Slug Generation

In `src/features/business/utils.ts`, implement `generateSlug(nameAr: string, businessId: string)`:

1. Transliterate Arabic to Latin characters (use `transliteration` npm package)
2. Convert to lowercase, replace spaces with `-`, strip special chars
3. Check DB for slug collision
4. If collision: append `-2`, `-3`, etc.

> **Example:** `"صيدلية رفاء طلا"` → `"saydaliyat-rafaa-talla"` → if taken → `"saydaliyat-rafaa-talla-2"`

---

### Server Actions

`src/features/business/actions.ts`:

**`createListingAction(data)`:**

1. Authenticate + verify email verified
2. Check listing count < `max_listings_per_owner` setting
3. Rate limit: max 1 new listing per 24 hours (Redis key: `listing_create:${userId}`)
4. Validate with `CreateListingSchema`
5. Generate slug
6. Create `BusinessProfile` with status `DRAFT`
7. Create `WorkingHours` rows (all 7 days, default closed)
8. Write audit log
9. Return `{ id, slug }`

**`updateListingAction(listingId, data)`:**

1. Verify ownership: `prisma.businessProfile.findFirst({ where: { id, ownerId: session.userId } })`
2. Build a JSON diff of what changed (for audit log)
3. Update fields
4. If `nameAr` changed: regenerate slug
5. Update `searchableText`: concatenate `nameAr + nameEn + descriptionAr + addressAr` (space-separated)
6. Write audit log with diff
7. Call `revalidatePath` on the public profile URL (invalidates ISR cache)

**`submitListingAction(listingId)`:**

1. Verify ownership
2. Verify required fields are filled (name, category, city, at least one phone)
3. Set `status: ACTIVE`, `publishedAt: now()`
4. Send "listing published" email notification to owner
5. Write audit log
6. Call `revalidatePath` on category page + profile page

**`softDeleteListingAction(listingId)`:**

1. Verify ownership OR admin role
2. Set `deletedAt: now()`, `deletedBy: session.userId`
3. Write audit log
4. Invalidate PDF cache for city/category

---

### Queries

`src/features/business/queries.ts`:

- `getListingBySlug(slug)`: includes phones, hours, socials, media (approved only), category, city
- `getListingsByOwner(ownerId)`: all listings including drafts (for dashboard)
- `getPublicListings(filters)`: only ACTIVE + not deleted, for directory browse
- `searchListings(query, filters)`: the pg_trgm powered search (covered in Phase 6)

---

### Owner Dashboard UI

- Dashboard home page: cards showing listing count by status, recent notifications
- Listings list page: table with columns: Name, Category, Status badge, Views, Published date, Actions (Edit / Delete / Preview)
- Multi-step edit flow (separate pages to avoid one giant form):
  - Step 1 `/dashboard/listings/[id]`: Basic info (name AR/EN, description, category, subcategory, city)
  - Step 2 `/dashboard/listings/[id]/contact`: Phones (dynamic add/remove), address, map coordinates
  - Step 3 `/dashboard/listings/[id]/hours`: Working hours per day
  - Step 4 `/dashboard/listings/[id]/social`: Social media links
  - Step 5 `/dashboard/listings/[id]/media`: Photos + Videos (Phase 5)
- Each step: React Hook Form + Zod, auto-save on valid change (debounced 2 seconds), clear unsaved indicator

---

### Public Profile Page (ISR)

`src/app/[locale]/(public)/[citySlug]/[categorySlug]/[businessSlug]/page.tsx`:

- `generateStaticParams`: pre-generate top 100 most-viewed listings at build time
- `generateMetadata`: dynamic title = `{nameAr} | {categoryNameAr} | النبك`, OG image = cover image
- Page displays: header (cover + logo + name + verified badge), contact section, working hours grid, photo gallery, video section, social links, map embed (static Google Maps image, no JS API needed), flag report button
- Schema.org JSON-LD: `LocalBusiness` structured data

---

### View Counter

`POST /api/v1/businesses/:id/view` — fire-and-forget from client:

- Rate limit: 1 count per IP per listing per 24 hours (prevents self-inflation)
- Increment `viewCount` with Prisma atomic update: `{ increment: 1 }`
- Never block page render for this — fire from `useEffect` on page load

---

### ✅ Phase 4 Done Criteria

- [ ] Owner signs in → creates listing with all fields → submits → status shows `ACTIVE`
- [ ] Public URL `/al-nabik/pharmacies/saydaliyat-rafaa-talla` renders the profile
- [ ] Editing the listing and saving calls `revalidatePath` — refreshing the public page shows new data within seconds
- [ ] Dashboard shows correct listing count and status badges

---

## Phase 5: Media Upload System

**Complexity:** High | **Estimated Time:** 5–7 days | **Dependencies:** Phase 0–4

**Goal:** Business owners can upload a cover image, logo, photo gallery, and videos. Images are auto-processed. Videos await admin approval.

---

### Cloudinary Configuration

- Install:
  ```bash
  npm install cloudinary
  ```
- Create `src/features/media/cloudinary.ts` — SDK wrapper:
  - `generateUploadSignature(folder, publicId)` — creates signed upload parameters
  - `deleteAsset(publicId)` — removes file from Cloudinary
  - `getVideoMetadata(publicId)` — retrieves duration, codec info
- In Cloudinary dashboard: create two upload presets — `images_unsigned` and `videos_unsigned`

---

### Image Processing Pipeline

- Install:
  ```bash
  npm install sharp
  ```
- Create `src/features/media/image-processor.ts`:
  - `processImage(inputBuffer)`: strip EXIF → auto-orient → resize (max 1920px) → convert to WebP (quality 82) → return processed buffer + dimensions
  - `generateThumbnail(inputBuffer)`: resize to 400×300 → WebP quality 70 → return buffer

---

### File Validators

Create `src/features/media/validators.ts`:

- `validateImageFile(file)`: check magic bytes (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, WebP: `52 49 46 46`), size limit
- `validateVideoFile(file)`: check magic bytes for MP4 (`00 00 00 ... ftyp`), size limit

> **WHY magic bytes?** A user can rename `malware.exe` to `photo.jpg`. The extension check passes. Magic bytes are the first bytes of the actual binary content — they cannot be faked without breaking the file format.

---

### Server Actions

`src/features/media/actions.ts`:

- `generatePresignedUrlAction(listingId, type)`: auth check → ownership → limits → return Cloudinary signature
- `confirmUploadAction(mediaFileId, cloudinaryPublicId, type)`:
  - For images: run Sharp pipeline → re-upload → update DB status to `APPROVED`
  - For videos: run ffprobe duration check → if valid set status `PENDING` + notify admin
- `deleteMediaAction(mediaFileId)`: verify ownership → delete from Cloudinary → delete DB record → if was cover/logo, clear `businessProfile.coverImageId`/`logoImageId`
- `reorderMediaAction(listingId, orderedIds)`: verify ownership → bulk update `displayOrder`

---

### Upload UI Components

`src/components/forms/MediaUploadForm.tsx`:

- Drag-and-drop zone using `react-dropzone`
- Per-file progress bar using `XMLHttpRequest`
- Preview thumbnails with delete button
- Cover image crop interface using `react-image-crop`
- Video upload shows "awaiting review" badge after upload

```bash
npm install react-dropzone react-image-crop
```

---

### Admin Video Moderation Queue

`src/app/[locale]/(admin)/admin/media/page.tsx` — Server Component:

- Table: listing name + video thumbnail + duration + uploader + upload date
- Action buttons: Preview (plays inline), Approve, Reject (requires reason input)
- Approve calls `approveMediaAction(mediaFileId)` → status `APPROVED` → owner notified
- Reject calls `rejectMediaAction(mediaFileId, reason)` → status `REJECTED` → file deleted from Cloudinary → owner notified by email

---

### ✅ Phase 5 Done Criteria

- [ ] Upload a JPEG → it appears in gallery as WebP with no EXIF data
- [ ] Upload a renamed `.exe` with `.jpg` extension → server rejects it with clear error
- [ ] Upload a video → it appears as "pending review" in owner dashboard
- [ ] Admin approves the video → it appears on the public profile
- [ ] Delete a photo → it disappears from Cloudinary AND the DB record is gone

---

## Phase 6: Public Directory (Browse / Search / Filter)

**Complexity:** High | **Estimated Time:** 5–6 days | **Dependencies:** Phase 0–5

**Goal:** Any citizen can browse, search, and filter the directory. Search results are fast, shareable via URL, and work correctly with Arabic text.

**WHY pagination is offset-based (not cursor-based):** Cursor-based pagination is ideal for infinite scroll feeds (like Twitter) where you always move forward. A directory is navigated differently — users jump to page 3, share a link to page 5, or bookmark a filtered view. Offset-based pagination supports direct page access. The performance concern (slow at offset 10000) is irrelevant at < 100,000 listings.

---

### Search Query Implementation

Create `src/features/business/queries.ts` — `searchListings` function:

```typescript
// src/features/business/queries.ts
// HOW pg_trgm search works:
// We update the searchable_text column (nameAr + nameEn + descriptionAr + addressAr)
// on every listing save. Then we query using ILIKE with the GIN index.
// ILIKE '%محمد%' on a GIN-indexed column is fast even at 100k rows.

export async function searchListings(params: SearchParams) {
  const {
    query,
    citySlug,
    categorySlug,
    isVerified,
    hasPhone,
    sort,
    page,
    limit,
  } = params;

  // Build WHERE conditions
  const where: Prisma.BusinessProfileWhereInput = {
    status: "ACTIVE",
    deletedAt: null,
    ...(citySlug && { city: { slug: citySlug } }),
    ...(categorySlug && { category: { slug: categorySlug } }),
    ...(isVerified && { isVerified: true }),
    ...(hasPhone && { phoneNumbers: { some: {} } }),
    // For search queries, use Prisma's raw-compatible approach
    // The actual ILIKE is done via $queryRaw for performance
  };

  if (query) {
    // Use raw SQL for pg_trgm similarity search
    return prisma.$queryRaw`
      SELECT bp.*, similarity(bp.searchable_text, ${query}) AS rank
      FROM business_profiles bp
      JOIN cities c ON bp.city_id = c.id
      JOIN categories cat ON bp.category_id = cat.id
      WHERE bp.status = 'ACTIVE'
        AND bp.deleted_at IS NULL
        AND bp.searchable_text ILIKE ${"%" + query + "%"}
        ${citySlug ? Prisma.sql`AND c.slug = ${citySlug}` : Prisma.empty}
        ${categorySlug ? Prisma.sql`AND cat.slug = ${categorySlug}` : Prisma.empty}
      ORDER BY rank DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;
  }

  // No query: use Prisma ORM (cleaner, type-safe)
  return prisma.businessProfile.findMany({
    where,
    orderBy:
      sort === "views"
        ? { viewCount: "desc" }
        : sort === "alpha"
          ? { nameAr: "asc" }
          : { publishedAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    include: {
      category: true,
      city: true,
      phoneNumbers: { where: { isPrimary: true } },
    },
  });
}
```

---

### URL State with nuqs

- Install:
  ```bash
  npm install nuqs
  ```
- Create `src/hooks/useSearchFilters.ts` — manages all filter/search/page state via URL params using `nuqs`. When a user changes a filter, the URL updates and is shareable

---

### Homepage

`src/app/[locale]/(public)/page.tsx` — ISR:

- Hero section with search bar
- Category grid (loaded from cached API)
- "Browse by city" section (just Al Nabik for now)
- Recent listings grid (latest 8 ACTIVE)

---

### Category Listing Page

`src/app/[locale]/(public)/[citySlug]/[categorySlug]/page.tsx` — ISR (revalidate: 1800):

- Grid of `BusinessCard` components
- Sidebar filter panel (verify status, has phone, has photos)
- Sort dropdown
- Pagination controls

---

### Search Results Page

`src/app/[locale]/(public)/search/page.tsx` — SSR (no ISR — every query is unique):

- Reads `?q=`, `?city=`, `?category=`, `?sort=`, `?page=` from URL via `nuqs`
- Server-renders results (no client-side fetching — important for SEO)
- Empty state: `"لا توجد نتائج لـ [query]"` with suggestion to try different keywords

---

### Autocomplete Endpoint

`GET /api/v1/search/suggest?q=` — returns top 5 matching listing names:

- Redis cache: `suggest:${query}` with 60-second TTL
- `SELECT name_ar FROM business_profiles WHERE name_ar ILIKE '%${query}%' AND status = 'ACTIVE' LIMIT 5`

---

### SEO

- Dynamic `sitemap.xml`: route handler at `src/app/sitemap.ts` — generates URLs for all ACTIVE listings + category pages
- Dynamic `robots.txt`: `src/app/robots.ts` — disallow `/dashboard`, `/admin`, `/api`
- `generateMetadata` on every public page with correct title, description, OG image
- JSON-LD `LocalBusiness` on every business profile page

---

### ✅ Phase 6 Done Criteria

- [ ] Search for `"محمد"` returns all listings with `"محمد"` in name or description
- [ ] Searching with a typo still returns results (pg_trgm similarity)
- [ ] Filter by "verified only" correctly hides unverified listings
- [ ] Applying filters updates the URL — copy URL → open new tab → same results appear
- [ ] `sitemap.xml` lists all active listings

---

## Phase 7: Admin Panel

**Complexity:** High | **Estimated Time:** 6–8 days | **Dependencies:** Phase 0–6

**Goal:** Admins have full visibility and control over the platform. They can moderate content, manage users, view metrics, and configure settings.

---

### Admin Metrics Dashboard

Create `src/features/admin/queries.ts` — `getAdminMetrics()`:

- Total ACTIVE listings, DRAFT listings, SUSPENDED listings
- New registrations this week (users created in last 7 days)
- Unresolved flags count
- Pending videos count
- Listings per category (for chart)

`src/app/[locale]/(admin)/admin/page.tsx` — renders metric cards

---

### Listings Management

`src/app/[locale]/(admin)/admin/listings/page.tsx`:

- Filter tabs: All / Active / Draft / Suspended
- Searchable by name, owner email
- Table: Name, Category, City, Owner, Status, Views, Published date, Actions
- Bulk select + bulk suspend

`admin/listings/[id]/page.tsx`:

- Full listing preview (same view as public page)
- Owner info panel
- Flag history tab
- Audit log tab for this listing
- Actions: Suspend / Restore / Grant Verification / Revoke Verification

---

### Admin Server Actions

`src/features/admin/actions.ts`:

- `suspendListingAction(listingId, reason)`: ADMIN role check → `status: SUSPENDED` → notify owner → audit log → invalidate ISR cache
- `restoreListingAction(listingId)`: ADMIN → `status: ACTIVE` → notify owner → audit log
- `grantVerificationAction(listingId)`: ADMIN → `isVerified: true`, `verifiedById`, `verifiedAt` → notify owner → audit log
- `revokeVerificationAction(listingId)`: ADMIN → `isVerified: false` → audit log
- `banUserAction(userId)`: ADMIN → soft delete user → delete all sessions → audit log
- `changeUserRoleAction(userId, newRole)`: SUPER_ADMIN only → update role → audit log

---

### Users Management

- `admin/users/page.tsx`: searchable user table with role badges, ban/restore actions
- `admin/users/[id]/page.tsx`: user profile, all their listings, audit trail

---

### Flags Queue

- `admin/flags/page.tsx`: unresolved flags table with listing preview inline
- Resolve flag modal: resolution notes + action (no action / suspend listing / ignore flag)

---

### Audit Log Viewer

- `admin/audit-log/page.tsx`: filterable table by actor, entity type, action type, date range
- Show JSON diff for UPDATE actions (before/after values)

---

### Platform Settings UI

`admin/settings/page.tsx` (Super Admin only):

- Form with all `PlatformSetting` keys as labeled inputs with type validation
- On save: update DB + delete all `setting:*` Redis cache keys

---

### ✅ Phase 7 Done Criteria

- [ ] Admin can suspend a listing → it disappears from public directory immediately
- [ ] Admin can restore it → it reappears
- [ ] Super Admin changes `max_photos_per_listing` to 5 → next upload attempt on a listing with 5 photos fails with correct error
- [ ] Audit log shows every action performed in Phases 1–7 testing

---

## Phase 8: PDF Export

**Complexity:** Medium | **Estimated Time:** 3–4 days | **Dependencies:** Phase 0–4, Phase 6

**Goal:** Any visitor can download a PDF directory of businesses, filtered by city/category, in Arabic or English.

---

### Tasks

- Install:
  ```bash
  npm install @react-pdf/renderer
  ```
- Download and place Cairo Arabic font files in `public/fonts/` (`Cairo-Regular.ttf`, `Cairo-Bold.ttf`)
- Register fonts in `src/features/pdf/generator.ts`:

  ```typescript
  import { Font } from "@react-pdf/renderer";
  Font.register({
    family: "Cairo",
    fonts: [
      { src: "/fonts/Cairo-Regular.ttf" },
      { src: "/fonts/Cairo-Bold.ttf", fontWeight: "bold" },
    ],
  });
  ```

- Create `src/features/pdf/templates/DirectoryDocument.tsx` — the PDF React component with:
  - Cover page: city name in Arabic + category name + generation date
  - Business rows: `nameAr`, `addressAr`, all phone numbers
  - Footer on every page: generation timestamp + site URL
  - RTL layout with explicit `direction: 'rtl'` and `textAlign: 'right'` on all text styles

- Create `src/features/pdf/cache.ts` — Redis get/set/invalidate helpers
- Create `src/app/[locale]/(public)/pdf/route.ts` — the download endpoint:
  - Rate limit: 5 requests per IP per 10 minutes
  - Check Redis cache key `pdf:{city}:{category}:{lang}`
  - Cache hit → redirect to CDN URL
  - Cache miss → query DB → generate PDF → upload to Cloudinary → store URL in Redis → stream PDF

- Add PDF download button to homepage, category pages, and search results page
- Wire cache invalidation: call `invalidatePdfCache(city, category)` from `submitListingAction` and `suspendListingAction`

---

### ✅ Phase 8 Done Criteria

- [ ] Download "All Pharmacies in Al Nabik" PDF → opens valid PDF with correct Arabic text and phone numbers
- [ ] Download the same PDF again immediately → served from CDN redirect (no re-generation)
- [ ] Add a new listing → submit it → download PDF again → new listing appears in the PDF

---

## Phase 9: Notifications & Emails

**Complexity:** Medium | **Estimated Time:** 3–4 days | **Dependencies:** Phase 0–2, Phase 7

**Goal:** All transactional emails send reliably. In-app notification center shows unread notifications.

---

### Tasks

- Install:
  ```bash
  npm install resend @react-email/components
  ```
- Verify your sending domain in the Resend dashboard (add DNS TXT record)
- Create email templates in `src/features/notifications/templates/`:
  - `VerifyEmail.tsx`: welcome message + big verification button link
  - `PasswordReset.tsx`: reset link with 1-hour expiry warning
  - `ListingPublished.tsx`: `"تم نشر إعلانك!"` + link to public page
  - `ListingSuspended.tsx`: `"تم تعليق إعلانك"` + reason + contact info
  - `ListingRestored.tsx`: `"تم استعادة إعلانك"`
  - `VerificationGranted.tsx`: `"تهانينا! تم التحقق من إعلانك"`

- Create `src/features/notifications/sender.ts` — `sendNotification(userId, type, data)`:
  1. Create `Notification` DB record (for in-app center)
  2. Fetch user email + language preference
  3. Select correct email template + language
  4. Dispatch via Resend (async)
  5. Update `notification.sentAt` on success
  6. On failure: retry up to 3 times with exponential backoff. Log to Sentry if all retries fail

- Wire `sendNotification` calls into all relevant Server Actions (listing published, suspended, restored, verification granted, video approved/rejected)

- `src/app/[locale]/(dashboard)/dashboard/notifications/page.tsx`:
  - List all notifications with read/unread state
  - Mark as read on click
  - "Mark all as read" button
  - Notification badge count in dashboard header: count of `isRead: false` notifications

---

### ✅ Phase 9 Done Criteria

- [ ] Sign up → receive verification email within 5 seconds
- [ ] Submit a listing → receive "listing published" email
- [ ] Admin suspends your listing → receive suspension email with reason
- [ ] Notification center shows all events, badge count decrements as you read them

---

## Phase 10: SEO & Performance Optimization

**Complexity:** Medium | **Estimated Time:** 3–4 days | **Dependencies:** Phase 0–9

**Goal:** The site loads fast, ranks in search engines, and passes Core Web Vitals.

---

### Tasks

- Audit all public pages with `generateMetadata()` — ensure no page has duplicate or missing title/description
- Add `Schema.org/LocalBusiness` JSON-LD to every business profile page
- Add `Schema.org/ItemList` to category listing pages
- Configure `next/font` for Cairo (Arabic) and Inter (English) with `display: "swap"` and `subsets: ["arabic", "latin"]`
- Audit all `<Image>` usages: every image below the fold must have `loading="lazy"`. Every image must have explicit `width` and `height` to prevent CLS (Cumulative Layout Shift)
- Configure `next.config.ts` image domains to allow Cloudinary CDN URLs
- Run Lighthouse on all main page types and document baseline scores
- Add Lighthouse CI to GitHub Actions — fail PR if performance score drops below 80

**WCAG 2.1 AA audit checklist:**

- All icon-only buttons have `aria-label`
- Skip-to-main-content link at top of every page
- Color contrast ratio ≥ 4.5:1 for all text
- All form inputs have associated `<label>` elements
- Focus outlines are visible (remove `outline: none` from CSS)

- Verify RTL layout is correct at all breakpoints for Arabic locale
- Run `@next/bundle-analyzer` and identify any unexpectedly large dependencies

---

## Phase 11: Testing & QA

**Complexity:** High | **Estimated Time:** 5–7 days | **Dependencies:** Phase 0–10

**Goal:** The core user flows are tested automatically so no regression goes undetected.

**WHY not write tests as you go?** For a small team building a project for the first time, writing tests first (TDD) often slows down exploration. But untested code going to production is reckless. Phase 11 is the structured catch-up — you write tests for the critical paths now that the API contracts are stable.

---

### Unit Tests (Jest)

- Configure Jest + `@testing-library/react` in `jest.config.ts`
- Test `src/features/auth/utils.ts`: `hashPassword`, `verifyPassword`, `generateSecureToken`, `hashToken`
- Test `src/features/business/utils.ts`: `generateSlug` (collision handling), `canTransitionTo` (all state transitions)
- Test `src/features/media/validators.ts`: `validateImageFile` (correct magic bytes pass, incorrect reject)
- Test all Zod schemas: valid data passes, invalid data returns the correct error field
- **Target:** 80% coverage on `src/lib/` and `src/features/`

---

### Integration Tests (Jest + Test DB)

- Configure a separate test PostgreSQL database in CI
- Test auth API routes: sign up, verify email, sign in, reset password — assert DB state after each step
- Test listing creation: owner creates listing → submits → status is `ACTIVE` → audit log entry exists
- Test RBAC: non-admin calling `POST /admin/listings/:id/suspend` → returns 403
- Test media limits: uploading photo #11 when max is 10 → returns 400 with correct error code

---

### E2E Tests (Playwright)

- Configure Playwright against `localhost:3000` (dev) and `staging.yourdomain.com` (CI)
- `tests/e2e/auth.spec.ts`: full sign-up → email verify → sign-in → sign-out flow
- `tests/e2e/listing-creation.spec.ts`: sign in → create listing → fill all fields → submit → verify public URL works
- `tests/e2e/search.spec.ts`: search for listing by Arabic name → correct result appears → click → profile page loads
- `tests/e2e/admin.spec.ts`: admin signs in → suspends listing → listing disappears from public directory → restores it → reappears

---

## Phase 12: Deployment & CI/CD

**Complexity:** Medium | **Estimated Time:** 2–3 days | **Dependencies:** Phase 0–11

**Goal:** Every PR runs the test suite. Every merge to `main` deploys to production automatically with zero downtime.

---

### Vercel Configuration

- Add all production environment variables in Vercel dashboard (Settings → Environment Variables)
- Set build command: `prisma migrate deploy && next build`

  > `prisma migrate deploy` applies any pending migrations before the new code goes live — this is how you do zero-downtime DB migrations in a serverless environment.

- Enable Vercel Speed Insights and Web Analytics

---

### GitHub Actions Finalization

Update `ci.yml` to run unit + integration tests in CI:

```yaml
# .github/workflows/ci.yml
- name: Run unit tests
  run: npm test -- --coverage --ci

- name: Run integration tests
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  run: npm run test:integration
```

Create `cd.yml` — triggered on push to `main`:

```yaml
# .github/workflows/cd.yml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--prod"
```

- Create `e2e.yml` — runs Playwright against the Vercel preview URL for every PR
- Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` to GitHub repository secrets

---

### Production Monitoring

- Configure Sentry DSN in Vercel env vars — add Sentry Next.js plugin to `next.config.ts`
- Set up Sentry alert: email notification when error rate exceeds 10 errors/minute
- Configure `GET /api/v1/health` to be pinged by an uptime monitor (UptimeRobot free tier)
- Verify Vercel Analytics is receiving page view data after first production deploy

---

### ✅ Phase 12 Done Criteria

- [ ] Push a PR → CI runs in < 5 minutes → green/red check appears on GitHub
- [ ] Merge to `main` → Vercel deploy starts automatically → production updated in < 3 minutes
- [ ] Sentry dashboard shows errors from production
- [ ] `GET /api/v1/health` returns `{ db: "ok", redis: "ok" }`

---

## Phase 13: Mobile API Layer (Future-Proofing)

**Complexity:** Low | **Estimated Time:** 2–3 days | **Dependencies:** Phase 0–12

**Goal:** Ensure all API endpoints work correctly as a standalone REST API for future native mobile apps, without any changes to the web application.

**WHY last?** The API already exists — you built it in every previous phase. This phase is about auditing it, documenting it, and adding the few things that web apps don't need but mobile apps do (device token push notifications, API key auth for the mobile client).

---

### Tasks

- Audit all `GET /api/v1/*` endpoints: verify they return correct `Content-Type: application/json` and the standard `{ success, data, error, meta }` shape
- Add API versioning header support: `Accept: application/vnd.city-directory.v1+json`
- Document all endpoints in `docs/api-reference.md` with: method, URL, auth requirements, request body schema, response schema, example `curl` command
- Add `GET /api/v1/auth/me` endpoint: returns current authenticated user's profile (used by mobile apps to bootstrap session)
- Test all endpoints with a REST client (Bruno or Postman) — create a collection file at `docs/city-directory.postman_collection.json`
- Consider: push notification infrastructure (Firebase FCM) for future listing status change alerts to mobile users — add `deviceToken` field to `User` model as a migration-ready placeholder

---

## Risk Assessment

### Risk 1: Arabic Text in PDFs Renders Incorrectly

**Probability:** High | **Impact:** High

`@react-pdf/renderer` has documented RTL issues. Arabic may render left-to-right or letters may appear disconnected (not joined).

**Mitigation:**

- Write a PDF generation test in Phase 8 that generates a PDF and visually inspect it before calling the phase done
- If `@react-pdf/renderer` cannot handle connected Arabic glyphs, fall back to PDf

## 5. Phase 0 — Complete Implementation Guide

### Goal

Any developer clones this repo, runs 3 commands, and is contributing within 20 minutes.

### Prerequisites

```bash
node --version    # Must be >= 20.0.0
pnpm --version    # Must be >= 9.0.0
git --version     # Any recent version
docker --version  # For local PostgreSQL + Redis
```

Install pnpm if missing:

```bash
npm install -g pnpm
```

### Setup Steps (In Order)

#### Step 1: Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/city-directory.git
cd city-directory
```

#### Step 2: Create the project (already done — for reference)

```bash
# This command was used to initialize the project
pnpm create next-app@latest . --yes
# --yes uses defaults: TypeScript, Tailwind, ESLint, App Router, Turbopack, @/* import alias
```

**What `--yes` installed:**

- Next.js 16.2.1
- React 19.2.4
- Tailwind CSS 4.2.2 (v4 — NO config file needed)
- TypeScript 5.9.3
- ESLint 9.x (flat config format — NOT .eslintrc)

#### Step 3: Add src/ folder structure

```bash
mkdir src
# Windows PowerShell:
Move-Item app src/app
# Mac/Linux:
mv app src/app
```

**WHY src/?** Root stays clean — only config files at root, all application code in `src/`. With 14+ config files at root already, mixing in application code creates confusion.

#### Step 4: Initialize shadcn/ui

```bash
npx shadcn@latest init
# Select: Radix (mature, battle-tested over Base UI)
# Select: Nova preset (compact + clean — good for directory + admin)
# Select: Slate base color
# Select: Yes to CSS variables
```

Then move shadcn files into src/ (shadcn defaults to root):

```bash
mv components src/components
mv lib src/lib
mv hooks src/hooks
```

Update `components.json` aliases to point to src/:

```json
{
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

#### Step 5: Configure TypeScript (strict mode)

Add to `tsconfig.json` compilerOptions:

```json
{
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

Add scripts to `package.json`:

```json
{
  "type-check": "tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

#### Step 6: Configure ESLint 9 + Prettier

**CRITICAL:** ESLint 9 uses flat config (`eslint.config.mjs`) — NOT `.eslintrc.json`. These are incompatible.

Install:

```bash
pnpm add -D prettier eslint-config-prettier @eslint/compat typescript-eslint
```

Replace `eslint.config.mjs` with flat config using native next-intl support (see file in repo).

#### Step 7: Configure Husky + Commitlint + lint-staged

```bash
pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional
npx husky init
```

**CRITICAL for pnpm:** Use `pnpm exec` not `npx` in hook files.

`.husky/pre-commit`:

```bash
npx lint-staged
```

`.husky/commit-msg`:

```bash
# CORRECT for pnpm:
pnpm exec commitlint --edit $1
# WRONG (causes "Unknown option: 'no'" error):
# npx --no -- commitlint --edit $1
```

**Conventional Commits format:** `type(scope): description`

- `feat(auth): add Google OAuth` ✅
- `fix(listings): correct slug generation` ✅
- `stuff i did` ❌ (BLOCKED by commitlint)

#### Step 8: Configure Docker

```bash
# Start local PostgreSQL + Redis
docker compose up -d

# Verify both containers healthy
docker compose ps
```

#### Step 9: Configure Environment Variables

Three separate files — each serves a different reader:

| File           | Read By                | Contains                               | Git?   |
| -------------- | ---------------------- | -------------------------------------- | ------ |
| `.env.example` | Humans (documentation) | Fake placeholder values                | ✅ YES |
| `.env`         | Prisma CLI             | DATABASE_URL, DIRECT_DATABASE_URL only | ❌ NO  |
| `.env.local`   | Next.js app            | All other variables                    | ❌ NO  |

**WHY does Prisma need its own `.env` file?**
Prisma CLI runs as a separate process outside Next.js. It cannot read `.env.local`. It reads `.env` (a standard dotenv convention). Next.js also reads `.env` but `.env.local` takes precedence.

#### Step 10: Environment Variable Validation

`src/env.ts` validates ALL environment variables at startup using Zod.

**Fail Fast principle:** The application refuses to start if any required variable is missing or malformed. You find out in CI, not after users are affected.

#### Step 11: Prisma Setup

```bash
# Always use pnpm exec — never pnpx
pnpm exec prisma init --datasource-provider postgresql
pnpm exec prisma migrate dev --name init_health_check
pnpm exec prisma studio  # Visual DB browser at localhost:5555
```

**Singleton pattern in `src/lib/prisma.ts`:**
Without singleton: Next.js hot-reload creates new PrismaClient on each save → 50+ database connections → PostgreSQL crashes.
With singleton: globalThis persists across hot-reloads → one connection pool → stable.

#### Step 12: Redis Client

`src/lib/redis.ts` — Upstash HTTP-based Redis client.

Cache key constants prevent "string scattered in 5 files" bugs.
Cache TTL constants encode business rules explicitly.

#### Step 13: Infrastructure Utilities

- `src/lib/constants.ts` — all magic numbers in one place
- `src/lib/api-response.ts` — standard `{ success, data, error, meta }` shape for ALL API responses
- `src/lib/error-codes.ts` — machine-readable error codes prevent string comparisons across codebase

**WHY a standard API response shape?**
Mobile apps can write ONE response handler for all endpoints. Frontend code checks `response.success` uniformly. Errors always have a machine-readable `code` and human-readable `message`.

#### Step 14: i18n Setup (next-intl)

**Folder structure for locale routing:**

```
src/app/
├── [locale]/           ← All pages live here
│   ├── layout.tsx      ← Sets html lang, dir (rtl/ltr), loads fonts, provides i18n context
│   └── page.tsx        ← Home page
└── layout.tsx          ← Minimal root layout (Next.js requirement)
```

**CRITICAL — root layout.tsx MUST have html and body tags:**

```tsx
// src/app/layout.tsx — MUST have html and body
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

**[locale]/layout.tsx does NOT add another html/body — it wraps children only.**

**RTL/LTR direction:**

```tsx
const direction = locale === "ar" ? "rtl" : "ltr";
// Applied to html element in [locale]/layout.tsx via suppressHydrationWarning
```

**Middleware (`src/middleware.ts`) handles:**

- `localhost:3000` → redirects to `/ar/`
- `localhost:3000/en/...` → serves English version
- `localhost:3000/fr/...` → 404 (not in supported locales)

### Phase 0 Done Criteria

Run all three before committing:

```bash
pnpm dev          # localhost:3000 redirects to /ar/ ✅
pnpm type-check   # 0 TypeScript errors ✅
pnpm lint         # 0 ESLint errors ✅
pnpm build        # Production build succeeds ✅
```

Test URLs:

- `http://localhost:3000` → redirects to `/ar/`
- `http://localhost:3000/ar` → Arabic home page
- `http://localhost:3000/en` → English home page
- `http://localhost:3000/fr` → 404

---

## 6. Folder Structure

```
city-directory/
│
├── .github/
│   └── workflows/
│       ├── ci.yml          ← Runs on every PR: lint + type-check + build
│       └── cd.yml          ← Runs on merge to main: deploy to Vercel
│
├── .husky/
│   ├── pre-commit          ← Runs lint-staged before every commit
│   └── commit-msg          ← Validates conventional commit format
│
├── docs/
│   ├── RFC-001-architecture.md    ← Full architecture decision document
│   └── decisions/
│       ├── ADR-001-monolith.md    ← Why monolith over microservices
│       ├── ADR-002-pg-trgm.md     ← Why trigram search for Arabic
│       ├── ADR-003-auto-approve.md ← Why auto-approve listings
│       └── ADR-004-pdf-rendering.md ← PDF library choice
│
├── prisma/
│   ├── schema.prisma       ← Database blueprint — single source of truth
│   ├── seed.ts             ← Seed data (cities, categories, admin user)
│   └── migrations/         ← Auto-generated SQL migration files (committed to Git)
│
├── public/
│   └── fonts/              ← Local font files (Cairo for PDF generation)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                    ← Root layout (html + body, minimal)
│   │   ├── [locale]/
│   │   │   ├── layout.tsx                ← Locale layout (lang, dir, fonts, i18n provider)
│   │   │   ├── page.tsx                  ← Home page
│   │   │   ├── (auth)/                   ← Route group: auth pages (no layout shared with app)
│   │   │   │   ├── sign-in/page.tsx
│   │   │   │   ├── sign-up/page.tsx
│   │   │   │   ├── forgot-password/page.tsx
│   │   │   │   ├── reset-password/page.tsx
│   │   │   │   └── verify-email/page.tsx
│   │   │   ├── (public)/                 ← Route group: public directory pages
│   │   │   │   ├── [citySlug]/
│   │   │   │   │   └── [categorySlug]/
│   │   │   │   │       ├── page.tsx      ← Category listing page
│   │   │   │   │       └── [businessSlug]/
│   │   │   │   │           └── page.tsx  ← Business profile page
│   │   │   │   └── search/page.tsx       ← Search results page
│   │   │   ├── (dashboard)/              ← Route group: business owner dashboard
│   │   │   │   └── dashboard/
│   │   │   │       ├── page.tsx
│   │   │   │       └── listings/
│   │   │   │           └── [id]/page.tsx
│   │   │   └── (admin)/                  ← Route group: admin panel
│   │   │       └── admin/
│   │   │           ├── page.tsx
│   │   │           ├── listings/page.tsx
│   │   │           └── users/page.tsx
│   │   ├── api/
│   │   │   └── v1/                       ← All API routes versioned under /v1
│   │   │       ├── auth/[...nextauth]/route.ts
│   │   │       ├── categories/route.ts
│   │   │       ├── businesses/
│   │   │       │   └── [id]/
│   │   │       │       └── view/route.ts
│   │   │       ├── search/suggest/route.ts
│   │   │       └── health/route.ts
│   │   └── sitemap.ts                    ← Auto-generated sitemap
│   │
│   ├── components/
│   │   ├── ui/                           ← shadcn/ui primitive components
│   │   └── shared/                       ← Our custom shared components
│   │
│   ├── features/                         ← Feature-based organization
│   │   ├── auth/
│   │   │   ├── actions.ts                ← Server Actions for auth
│   │   │   ├── schemas.ts                ← Zod validation schemas
│   │   │   └── utils.ts                  ← Password hashing, token generation
│   │   ├── business/
│   │   │   ├── actions.ts
│   │   │   ├── queries.ts                ← Database read operations
│   │   │   └── utils.ts                  ← Slug generation, state machine
│   │   ├── categories/
│   │   │   ├── actions.ts
│   │   │   └── queries.ts
│   │   ├── media/
│   │   │   ├── actions.ts
│   │   │   ├── cloudinary.ts
│   │   │   ├── image-processor.ts
│   │   │   └── validators.ts
│   │   ├── notifications/
│   │   │   ├── sender.ts
│   │   │   └── templates/                ← React Email templates
│   │   ├── pdf/
│   │   │   ├── generator.ts
│   │   │   ├── cache.ts
│   │   │   └── templates/
│   │   ├── admin/
│   │   │   ├── actions.ts
│   │   │   └── queries.ts
│   │   └── platform/
│   │       └── settings.ts               ← DB-backed settings with Redis cache
│   │
│   ├── hooks/                            ← React hooks
│   │   └── useSearchFilters.ts           ← URL state management via nuqs
│   │
│   ├── i18n/
│   │   ├── routing.ts                    ← Locale config (single source of truth)
│   │   └── request.ts                    ← Server-side locale resolution
│   │
│   ├── lib/
│   │   ├── prisma.ts                     ← Prisma singleton client
│   │   ├── redis.ts                      ← Upstash Redis client + cache constants
│   │   ├── auth.ts                       ← Auth.js v5 configuration (Phase 1)
│   │   ├── audit.ts                      ← Audit log writer (Phase 2)
│   │   ├── rate-limit.ts                 ← Rate limiting via Redis (Phase 1)
│   │   ├── api-response.ts               ← Standard API response builders
│   │   ├── error-codes.ts                ← Centralized error code constants
│   │   └── constants.ts                  ← All magic numbers in one place
│   │
│   ├── messages/
│   │   ├── ar.json                       ← Arabic translations (default)
│   │   └── en.json                       ← English translations
│   │
│   ├── middleware.ts                     ← Edge middleware: locale routing + auth checks
│   │
│   ├── types/
│   │   └── next-auth.d.ts                ← Augmented session types (Phase 1)
│   │
│   └── env.ts                            ← Zod environment variable validation
│
├── tests/
│   ├── unit/                             ← Jest unit tests
│   ├── integration/                      ← Jest + test DB integration tests
│   └── e2e/                              ← Playwright end-to-end tests
│
├── .env                                  ← Prisma-only env vars (gitignored)
├── .env.example                          ← Documented placeholders (committed)
├── .env.local                            ← Next.js app env vars (gitignored)
├── .eslintrc.mjs                         ← ESLint 9 flat config
├── .gitignore
├── .husky/
├── .prettierrc
├── .prettierignore
├── commitlint.config.js
├── components.json                       ← shadcn/ui configuration
├── docker-compose.yml                    ← Local dev infrastructure
├── next.config.ts                        ← Next.js + next-intl configuration
├── package.json
├── pnpm-lock.yaml                        ← Committed to Git (locks exact versions)
├── postcss.config.mjs                    ← Tailwind v4 PostCSS config
└── tsconfig.json
```

---

## 7. Problems We Faced & How We Solved Them

### Problem 1: `@next/eslint-plugin-next` Cannot Be Found

**Error:**

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@next/eslint-plugin-next'
```

**Root cause:** `@next/eslint-plugin-next` is a sub-package inside `eslint-config-next` — it cannot be imported directly. My initial config tried to import it as a standalone package.

**Solution:** Use `eslint-config-next`'s native flat config exports:

```javascript
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
```

**Lesson:** When a library gives `Cannot find package X`, first check if it's a sub-package that cannot be imported directly. Always check the official docs before community tutorials — official docs are updated with the package, tutorials go stale.

---

### Problem 2: ESLint Circular Structure JSON Error

**Error:**

```
TypeError: Converting circular structure to JSON
  property 'plugins' -> property 'react' closes the circle
```

**Root cause:** `FlatCompat` (the bridge between old ESLint config format and flat config) creates circular object references when converting the React plugin. `eslint-config-next` 16 ships its own React plugin which causes this when wrapped through FlatCompat.

**Solution:** `eslint-config-next` 16 was rewritten to natively support flat config — no FlatCompat needed:

```javascript
import nextVitals from "eslint-config-next/core-web-vitals"; // Native flat config ✅
```

**Lesson:** The JavaScript ecosystem moves fast. When a library throws a confusing internal error, always check if a new version of the library has native support for the feature you're trying to use. The official docs are the first place to look.

---

### Problem 3: Husky commit-msg Hook Failing with `Unknown option: 'no'`

**Error:**

```
ERROR  Unknown option: 'no'
husky - commit-msg script failed (code 1)
```

**Root cause:** The commit-msg hook used `npx --no --` syntax which is npm-specific. We're using pnpm.

**Solution:** Replace `npx --no -- commitlint` with `pnpm exec commitlint`:

```bash
# Wrong (npm syntax):
npx --no -- commitlint --edit $1

# Correct (pnpm syntax):
pnpm exec commitlint --edit $1
```

**Lesson:** Package manager commands are not interchangeable. `npx` = npm. `pnpm exec` = pnpm. Always use the command appropriate for your chosen package manager.

---

### Problem 4: `pnpx prisma init` Downloaded Prisma 7 Instead of Our Installed v6

**What happened:** Running `pnpx prisma init` downloaded Prisma 7.6.0 from the internet, ignoring our installed v6.

**Root cause:** `pnpx` = "download and run from internet". `pnpm exec` = "run from local node_modules".

**Solution:** Always use `pnpm exec prisma` for all Prisma commands:

```bash
# Wrong — downloads latest from internet:
pnpx prisma init

# Correct — uses installed version from node_modules:
pnpm exec prisma init
pnpm exec prisma migrate dev
pnpm exec prisma studio
```

**Lesson:** After deliberately pinning a package version, always use `pnpm exec` to run its CLI. This is true for ALL CLI tools (prisma, drizzle-kit, etc.).

---

### Problem 5: VS Code Prisma Extension Showing v7 Errors on v6 Schema

**Error (in VS Code, not terminal):**

```
The datasource property `url` is no longer supported in schema files.
Move connection URLs for Migrate to `prisma.config.ts`
```

**Root cause:** The VS Code Prisma extension auto-updated to use the Prisma 7 language server for schema validation, while the installed CLI is still v6. Two separate systems at different versions.

**Solution:** Add to `.vscode/settings.json`:

```json
{
  "prisma.prismaVersion": "6"
}
```

**Lesson:** The editor's language server and the installed CLI are different processes. Always trust `pnpm exec prisma validate` (the CLI) over VS Code red squiggles (the editor). The CLI is what actually runs your code.

---

### Problem 6: Prisma Cannot Find `DIRECT_DATABASE_URL`

**Error:**

```
Error code: P1012
error: Environment variable not found: DIRECT_DATABASE_URL.
```

**Root cause:** Prisma reads `.env`, not `.env.local`. The variable was in `.env.local` but not in `.env`.

**Solution:** Create a separate `.env` file (gitignored) with only the database URLs:

```bash
# .env — read by Prisma CLI
DATABASE_URL="postgresql://devuser:devpassword@localhost:5432/city_directory_dev"
DIRECT_DATABASE_URL="postgresql://devuser:devpassword@localhost:5432/city_directory_dev"
```

**Lesson:** Different tools read different env files. Know which file each tool reads:

- Prisma CLI → `.env`
- Next.js app → `.env.local` (overrides `.env`)
- Both → `.env` (but `.env.local` takes precedence in Next.js)

---

### Problem 7: `prisma.config.ts` Auto-Created — Causing False Errors

**What happened:** `pnpm exec prisma init` auto-created an empty `prisma.config.ts`. This confused the VS Code extension into thinking we're using Prisma 7 config system.

**Solution:** Delete it. Prisma 6 does not need `prisma.config.ts`:

```bash
rm prisma.config.ts
```

---

### Problem 8: shadcn Installed Files to Root Instead of `src/`

**What happened:** `npx shadcn@latest init` created `components/`, `lib/`, and `hooks/` at the project root, not inside `src/`.

**Root cause:** We chose `--yes` in `create-next-app` which did not create a `src/` folder by default. shadcn read this and installed to root.

**Solution:**

1. Manually moved folders to `src/` using Windows File Explorer (PowerShell permission issue prevented `mv` command)
2. Updated `components.json` aliases to point to `@/components`, `@/lib`, `@/hooks`

**Lesson:** When you configure a non-default project structure (src/ folder), you must also configure all dependent tools to follow that structure. Check each tool's config file after setup.

---

### Problem 9: Root Layout Missing `<html>` and `<body>` Tags

**Error:**

```
Runtime Error: Missing <html> and <body> tags in the root layout.
```

**Root cause:** Following next-intl's suggested pattern, we made `src/app/layout.tsx` return `{children}` directly without html/body tags. Next.js 16 requires html/body in the root layout.

**Solution:** Root layout has html/body. `[locale]/layout.tsx` wraps children only (no extra html/body):

```tsx
// src/app/layout.tsx — has html + body (Next.js requirement)
export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

// src/app/[locale]/layout.tsx — sets lang, dir, providers (NO html/body)
export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  // ... validation ...
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
```

**But to set lang and dir dynamically, use `generateStaticParams` + metadata:**
The locale-specific html attributes (`lang`, `dir`) are set via Next.js's `generateMetadata` or via a client component that sets them after hydration.

---

## 8. Key Decisions Log (Questions We Discussed)

### Decision 1: Auto-Approve Listings vs Manual Review

**Question:** Should new listings require admin approval before going live?

**Decision:** Auto-approve. Listings go live immediately with an "Unverified" badge.

**Rationale:** Manual review is a bottleneck. The badge informs users while allowing business owners to list immediately. Admins react to problems after the fact.

**Mitigations for abuse:**

- Rate limit: max 1 new listing per 24 hours per account
- Email verification required before creating listings
- Community flag system
- Admin can suspend listings and ban accounts

---

### Decision 2: Turbopack — Use It or Skip It?

**Question asked by junior:** "Turbopack seems important for faster development — why did you disable it?"

**Initial decision (wrong):** Disable Turbopack with `--no-turbopack`

**Corrected decision:** Enable Turbopack (omit the flag)

**Rationale:** Turbopack dev mode is fully stable in Next.js 15+. Next.js 16 makes it the default. Benefits: hot reload in ~150ms vs ~1.5s, cold start ~1.5s vs ~8s.

**Lesson for senior:** Always verify assumptions against current documentation. Next.js 16 changed this.

---

### Decision 3: `@latest` vs Pinned Version for `create-next-app`

**Question asked by junior:** "Why not just use `create-next-app@latest`?"

**Initial decision (wrong):** Pin to `@15`

**Corrected decision:** Use `@latest` (gets Next.js 16 — Active LTS)

**Rationale:** Starting a new project on a maintenance release (15.x) means upgrading to Active LTS (16.x) in 6 months. No reason to delay.

**Lesson:** Always check `endoflife.date/{technology}` before pinning a version.

---

### Decision 4: npm vs pnpm vs Bun

**Question asked by junior:** "Why not use pnpm or bun? They're faster."

**Decision:** Use pnpm

**Rationale:**

- pnpm: 3.4× faster than npm, zero compatibility issues, industry standard for monorepos
- Bun: fastest, but compatibility issues with some Prisma operations on Windows
- npm: no compelling reason to use in 2026

---

### Decision 5: Prisma 6 vs Prisma 7

**Decision:** Prisma 6

**Rationale:** Prisma 7 (November 2025) requires driver adapters — more setup, all online documentation references v6 patterns, and this is a learning project where minimizing unexpected breaking changes is valuable.

**Upgrade path:** Documented at `prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7`

---

### Decision 6: Geographic Scope

**Decision:** Single city (Al Nabik) at launch. URL: `/al-nabik/pharmacies/...`

**Architecture:** `Country → Region → City` hierarchy in database from Day 1. Adding a second city = zero code changes (one DB row).

**Principle:** Design for extension, not for the future. Don't build multi-city UI now (over-engineering). Do build the data model to support it.

---

### Decision 7: Business Verification — Two-Tier Trust System

**Decision:** Anyone can register. Listings show "Unverified" badge until admin verifies.

**Two tiers:**

- **Tier 0 (default):** Self-claimed. Live immediately with orange "غير موثق" badge.
- **Tier 1 (verified):** Admin contacts business, confirms information, grants blue "✓ موثق" badge.

**Rationale:** Serves the carpenter who has no certificate AND protects against fake professional listings. Creates incentive for business owners to cooperate with verification (they want the badge).

**Future:** Verification becomes a paid service. Infrastructure is already built.

---

### Decision 8: shadcn Radix vs Base UI

**Decision:** Radix UI

**Rationale:** Base UI released v1.0 in December 2025 — too new, small community, few tutorials. Radix has 4 years of production battle-testing.

---

### Decision 9: ESLint `.eslintrc.json` vs Flat Config

**What we learned:** ESLint 9 (which ships with Next.js 16) uses flat config (`eslint.config.mjs`). The old `.eslintrc.json` format is completely unsupported. Community tutorials written before 2025 show the old format.

**Key rule:** Always check ESLint's own docs for the current format, not tutorials.

---

## 9. Commands Reference

### Daily Development

```bash
# Start development server
pnpm dev

# Type checking (fast, no build)
pnpm type-check

# Lint source files
pnpm lint

# Format all files
pnpm format

# Check formatting without changing files
pnpm format:check
```

### Database (Prisma)

```bash
# ALWAYS use pnpm exec — never pnpx

# Validate schema
pnpm exec prisma validate

# Create and apply a new migration
pnpm exec prisma migrate dev --name your_migration_name

# Apply migrations (production — no new migration files)
pnpm exec prisma migrate deploy

# Open visual database browser
pnpm exec prisma studio

# Regenerate Prisma Client (after schema changes)
pnpm exec prisma generate

# Seed the database
pnpm exec prisma db seed

# Reset database (WARNING: deletes all data)
pnpm exec prisma migrate reset
```

### Docker

```bash
# Start Postgres + Redis
docker compose up -d

# Stop containers (data preserved)
docker compose down

# View container logs
docker compose logs -f

# Check container health
docker compose ps

# Nuclear reset (deletes all data)
docker compose down -v
```

### Git (Conventional Commits Required)

```bash
# Valid commit message format: type(scope): description
git commit -m "feat(auth): add Google OAuth provider"
git commit -m "fix(listings): correct slug for Arabic names"
git commit -m "chore(deps): upgrade Prisma to 6.19.2"
git commit -m "docs(readme): add setup instructions"
git commit -m "refactor(middleware): simplify RBAC check"
git commit -m "test(auth): add password hashing unit tests"

# Types: feat | fix | chore | docs | refactor | test | style | perf | ci
```

### Build & Deploy

```bash
# Production build
pnpm build

# Start production server locally
pnpm start
```

---

## 10. Environment Variables Reference

### `.env` (Prisma CLI only)

```bash
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
DIRECT_DATABASE_URL="postgresql://user:pass@host:5432/dbname"
```

### `.env.local` (Next.js app)

All variables from `.env.example` with real values. See `.env.example` for full documentation and descriptions.

### Variable naming convention

- `NEXT_PUBLIC_*` — exposed to browser (safe for public values only)
- Everything else — server-side only, never exposed to browser

---

## 11. What Comes Next

### Phase 1: Authentication System

**Goal:** User can sign up, verify email, sign in, reset password, sign out.

**Key files to create:**

- `src/lib/auth.ts` — Auth.js v5 configuration
- `src/lib/rate-limit.ts` — Rate limiting via Upstash Redis
- `src/middleware.ts` — Add auth checks to existing locale middleware
- `src/features/auth/actions.ts` — Server Actions for all auth operations
- `src/features/auth/schemas.ts` — Zod validation schemas
- `src/features/auth/utils.ts` — Password hashing, token generation
- `src/app/[locale]/(auth)/` — All auth pages

**Key packages to install:**

```bash
pnpm add next-auth@beta @auth/prisma-adapter bcryptjs
pnpm add -D @types/bcryptjs
```

**Before starting Phase 1:** Run `pnpm build` and confirm Phase 0 is fully complete. Never start a new phase on a failing build.

---

_This README is a living document. Update it after every significant decision, problem, or phase completion._
````

## 5. Phase 0 — Complete Implementation Guide

### Goal

Any developer clones this repo, runs 3 commands, and is contributing within 20 minutes.

### Prerequisites

```bash
node --version    # Must be >= 20.0.0
pnpm --version    # Must be >= 9.0.0
git --version     # Any recent version
docker --version  # For local PostgreSQL + Redis
```

Install pnpm if missing:

```bash
npm install -g pnpm
```

### Setup Steps (In Order)

#### Step 1: Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/city-directory.git
cd city-directory
```

#### Step 2: Create the project (already done — for reference)

```bash
# This command was used to initialize the project
pnpm create next-app@latest . --yes
# --yes uses defaults: TypeScript, Tailwind, ESLint, App Router, Turbopack, @/* import alias
```

**What `--yes` installed:**

- Next.js 16.2.1
- React 19.2.4
- Tailwind CSS 4.2.2 (v4 — NO config file needed)
- TypeScript 5.9.3
- ESLint 9.x (flat config format — NOT .eslintrc)

#### Step 3: Add src/ folder structure

```bash
mkdir src
# Windows PowerShell:
Move-Item app src/app
# Mac/Linux:
mv app src/app
```

**WHY src/?** Root stays clean — only config files at root, all application code in `src/`. With 14+ config files at root already, mixing in application code creates confusion.

#### Step 4: Initialize shadcn/ui

```bash
npx shadcn@latest init
# Select: Radix (mature, battle-tested over Base UI)
# Select: Nova preset (compact + clean — good for directory + admin)
# Select: Slate base color
# Select: Yes to CSS variables
```

Then move shadcn files into src/ (shadcn defaults to root):

```bash
mv components src/components
mv lib src/lib
mv hooks src/hooks
```

Update `components.json` aliases to point to src/:

```json
{
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

#### Step 5: Configure TypeScript (strict mode)

Add to `tsconfig.json` compilerOptions:

```json
{
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

Add scripts to `package.json`:

```json
{
  "type-check": "tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

#### Step 6: Configure ESLint 9 + Prettier

**CRITICAL:** ESLint 9 uses flat config (`eslint.config.mjs`) — NOT `.eslintrc.json`. These are incompatible.

Install:

```bash
pnpm add -D prettier eslint-config-prettier @eslint/compat typescript-eslint
```

Replace `eslint.config.mjs` with flat config using native next-intl support (see file in repo).

#### Step 7: Configure Husky + Commitlint + lint-staged

```bash
pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional
npx husky init
```

**CRITICAL for pnpm:** Use `pnpm exec` not `npx` in hook files.

`.husky/pre-commit`:

```bash
npx lint-staged
```

`.husky/commit-msg`:

```bash
# CORRECT for pnpm:
pnpm exec commitlint --edit $1
# WRONG (causes "Unknown option: 'no'" error):
# npx --no -- commitlint --edit $1
```

**Conventional Commits format:** `type(scope): description`

- `feat(auth): add Google OAuth` ✅
- `fix(listings): correct slug generation` ✅
- `stuff i did` ❌ (BLOCKED by commitlint)

#### Step 8: Configure Docker

```bash
# Start local PostgreSQL + Redis
docker compose up -d

# Verify both containers healthy
docker compose ps
```

#### Step 9: Configure Environment Variables

Three separate files — each serves a different reader:

| File           | Read By                | Contains                               | Git?   |
| -------------- | ---------------------- | -------------------------------------- | ------ |
| `.env.example` | Humans (documentation) | Fake placeholder values                | ✅ YES |
| `.env`         | Prisma CLI             | DATABASE_URL, DIRECT_DATABASE_URL only | ❌ NO  |
| `.env.local`   | Next.js app            | All other variables                    | ❌ NO  |

**WHY does Prisma need its own `.env` file?**
Prisma CLI runs as a separate process outside Next.js. It cannot read `.env.local`. It reads `.env` (a standard dotenv convention). Next.js also reads `.env` but `.env.local` takes precedence.

#### Step 10: Environment Variable Validation

`src/env.ts` validates ALL environment variables at startup using Zod.

**Fail Fast principle:** The application refuses to start if any required variable is missing or malformed. You find out in CI, not after users are affected.

#### Step 11: Prisma Setup

```bash
# Always use pnpm exec — never pnpx
pnpm exec prisma init --datasource-provider postgresql
pnpm exec prisma migrate dev --name init_health_check
pnpm exec prisma studio  # Visual DB browser at localhost:5555
```

**Singleton pattern in `src/lib/prisma.ts`:**
Without singleton: Next.js hot-reload creates new PrismaClient on each save → 50+ database connections → PostgreSQL crashes.
With singleton: globalThis persists across hot-reloads → one connection pool → stable.

#### Step 12: Redis Client

`src/lib/redis.ts` — Upstash HTTP-based Redis client.

Cache key constants prevent "string scattered in 5 files" bugs.
Cache TTL constants encode business rules explicitly.

#### Step 13: Infrastructure Utilities

- `src/lib/constants.ts` — all magic numbers in one place
- `src/lib/api-response.ts` — standard `{ success, data, error, meta }` shape for ALL API responses
- `src/lib/error-codes.ts` — machine-readable error codes prevent string comparisons across codebase

**WHY a standard API response shape?**
Mobile apps can write ONE response handler for all endpoints. Frontend code checks `response.success` uniformly. Errors always have a machine-readable `code` and human-readable `message`.

#### Step 14: i18n Setup (next-intl)

**Folder structure for locale routing:**

```
src/app/
├── [locale]/           ← All pages live here
│   ├── layout.tsx      ← Sets html lang, dir (rtl/ltr), loads fonts, provides i18n context
│   └── page.tsx        ← Home page
└── layout.tsx          ← Minimal root layout (Next.js requirement)
```

**CRITICAL — root layout.tsx MUST have html and body tags:**

```tsx
// src/app/layout.tsx — MUST have html and body
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

**[locale]/layout.tsx does NOT add another html/body — it wraps children only.**

**RTL/LTR direction:**

```tsx
const direction = locale === "ar" ? "rtl" : "ltr";
// Applied to html element in [locale]/layout.tsx via suppressHydrationWarning
```

**Middleware (`src/middleware.ts`) handles:**

- `localhost:3000` → redirects to `/ar/`
- `localhost:3000/en/...` → serves English version
- `localhost:3000/fr/...` → 404 (not in supported locales)

### Phase 0 Done Criteria

Run all three before committing:

```bash
pnpm dev          # localhost:3000 redirects to /ar/ ✅
pnpm type-check   # 0 TypeScript errors ✅
pnpm lint         # 0 ESLint errors ✅
pnpm build        # Production build succeeds ✅
```

Test URLs:

- `http://localhost:3000` → redirects to `/ar/`
- `http://localhost:3000/ar` → Arabic home page
- `http://localhost:3000/en` → English home page
- `http://localhost:3000/fr` → 404

---

## 6. Folder Structure

```
city-directory/
│
├── .github/
│   └── workflows/
│       ├── ci.yml          ← Runs on every PR: lint + type-check + build
│       └── cd.yml          ← Runs on merge to main: deploy to Vercel
│
├── .husky/
│   ├── pre-commit          ← Runs lint-staged before every commit
│   └── commit-msg          ← Validates conventional commit format
│
├── docs/
│   ├── RFC-001-architecture.md    ← Full architecture decision document
│   └── decisions/
│       ├── ADR-001-monolith.md    ← Why monolith over microservices
│       ├── ADR-002-pg-trgm.md     ← Why trigram search for Arabic
│       ├── ADR-003-auto-approve.md ← Why auto-approve listings
│       └── ADR-004-pdf-rendering.md ← PDF library choice
│
├── prisma/
│   ├── schema.prisma       ← Database blueprint — single source of truth
│   ├── seed.ts             ← Seed data (cities, categories, admin user)
│   └── migrations/         ← Auto-generated SQL migration files (committed to Git)
│
├── public/
│   └── fonts/              ← Local font files (Cairo for PDF generation)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                    ← Root layout (html + body, minimal)
│   │   ├── [locale]/
│   │   │   ├── layout.tsx                ← Locale layout (lang, dir, fonts, i18n provider)
│   │   │   ├── page.tsx                  ← Home page
│   │   │   ├── (auth)/                   ← Route group: auth pages (no layout shared with app)
│   │   │   │   ├── sign-in/page.tsx
│   │   │   │   ├── sign-up/page.tsx
│   │   │   │   ├── forgot-password/page.tsx
│   │   │   │   ├── reset-password/page.tsx
│   │   │   │   └── verify-email/page.tsx
│   │   │   ├── (public)/                 ← Route group: public directory pages
│   │   │   │   ├── [citySlug]/
│   │   │   │   │   └── [categorySlug]/
│   │   │   │   │       ├── page.tsx      ← Category listing page
│   │   │   │   │       └── [businessSlug]/
│   │   │   │   │           └── page.tsx  ← Business profile page
│   │   │   │   └── search/page.tsx       ← Search results page
│   │   │   ├── (dashboard)/              ← Route group: business owner dashboard
│   │   │   │   └── dashboard/
│   │   │   │       ├── page.tsx
│   │   │   │       └── listings/
│   │   │   │           └── [id]/page.tsx
│   │   │   └── (admin)/                  ← Route group: admin panel
│   │   │       └── admin/
│   │   │           ├── page.tsx
│   │   │           ├── listings/page.tsx
│   │   │           └── users/page.tsx
│   │   ├── api/
│   │   │   └── v1/                       ← All API routes versioned under /v1
│   │   │       ├── auth/[...nextauth]/route.ts
│   │   │       ├── categories/route.ts
│   │   │       ├── businesses/
│   │   │       │   └── [id]/
│   │   │       │       └── view/route.ts
│   │   │       ├── search/suggest/route.ts
│   │   │       └── health/route.ts
│   │   └── sitemap.ts                    ← Auto-generated sitemap
│   │
│   ├── components/
│   │   ├── ui/                           ← shadcn/ui primitive components
│   │   └── shared/                       ← Our custom shared components
│   │
│   ├── features/                         ← Feature-based organization
│   │   ├── auth/
│   │   │   ├── actions.ts                ← Server Actions for auth
│   │   │   ├── schemas.ts                ← Zod validation schemas
│   │   │   └── utils.ts                  ← Password hashing, token generation
│   │   ├── business/
│   │   │   ├── actions.ts
│   │   │   ├── queries.ts                ← Database read operations
│   │   │   └── utils.ts                  ← Slug generation, state machine
│   │   ├── categories/
│   │   │   ├── actions.ts
│   │   │   └── queries.ts
│   │   ├── media/
│   │   │   ├── actions.ts
│   │   │   ├── cloudinary.ts
│   │   │   ├── image-processor.ts
│   │   │   └── validators.ts
│   │   ├── notifications/
│   │   │   ├── sender.ts
│   │   │   └── templates/                ← React Email templates
│   │   ├── pdf/
│   │   │   ├── generator.ts
│   │   │   ├── cache.ts
│   │   │   └── templates/
│   │   ├── admin/
│   │   │   ├── actions.ts
│   │   │   └── queries.ts
│   │   └── platform/
│   │       └── settings.ts               ← DB-backed settings with Redis cache
│   │
│   ├── hooks/                            ← React hooks
│   │   └── useSearchFilters.ts           ← URL state management via nuqs
│   │
│   ├── i18n/
│   │   ├── routing.ts                    ← Locale config (single source of truth)
│   │   └── request.ts                    ← Server-side locale resolution
│   │
│   ├── lib/
│   │   ├── prisma.ts                     ← Prisma singleton client
│   │   ├── redis.ts                      ← Upstash Redis client + cache constants
│   │   ├── auth.ts                       ← Auth.js v5 configuration (Phase 1)
│   │   ├── audit.ts                      ← Audit log writer (Phase 2)
│   │   ├── rate-limit.ts                 ← Rate limiting via Redis (Phase 1)
│   │   ├── api-response.ts               ← Standard API response builders
│   │   ├── error-codes.ts                ← Centralized error code constants
│   │   └── constants.ts                  ← All magic numbers in one place
│   │
│   ├── messages/
│   │   ├── ar.json                       ← Arabic translations (default)
│   │   └── en.json                       ← English translations
│   │
│   ├── middleware.ts                     ← Edge middleware: locale routing + auth checks
│   │
│   ├── types/
│   │   └── next-auth.d.ts                ← Augmented session types (Phase 1)
│   │
│   └── env.ts                            ← Zod environment variable validation
│
├── tests/
│   ├── unit/                             ← Jest unit tests
│   ├── integration/                      ← Jest + test DB integration tests
│   └── e2e/                              ← Playwright end-to-end tests
│
├── .env                                  ← Prisma-only env vars (gitignored)
├── .env.example                          ← Documented placeholders (committed)
├── .env.local                            ← Next.js app env vars (gitignored)
├── .eslintrc.mjs                         ← ESLint 9 flat config
├── .gitignore
├── .husky/
├── .prettierrc
├── .prettierignore
├── commitlint.config.js
├── components.json                       ← shadcn/ui configuration
├── docker-compose.yml                    ← Local dev infrastructure
├── next.config.ts                        ← Next.js + next-intl configuration
├── package.json
├── pnpm-lock.yaml                        ← Committed to Git (locks exact versions)
├── postcss.config.mjs                    ← Tailwind v4 PostCSS config
└── tsconfig.json
```

---

## 7. Problems We Faced & How We Solved Them

### Problem 1: `@next/eslint-plugin-next` Cannot Be Found

**Error:**

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@next/eslint-plugin-next'
```

**Root cause:** `@next/eslint-plugin-next` is a sub-package inside `eslint-config-next` — it cannot be imported directly. My initial config tried to import it as a standalone package.

**Solution:** Use `eslint-config-next`'s native flat config exports:

```javascript
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
```

**Lesson:** When a library gives `Cannot find package X`, first check if it's a sub-package that cannot be imported directly. Always check the official docs before community tutorials — official docs are updated with the package, tutorials go stale.

---

### Problem 2: ESLint Circular Structure JSON Error

**Error:**

```
TypeError: Converting circular structure to JSON
  property 'plugins' -> property 'react' closes the circle
```

**Root cause:** `FlatCompat` (the bridge between old ESLint config format and flat config) creates circular object references when converting the React plugin. `eslint-config-next` 16 ships its own React plugin which causes this when wrapped through FlatCompat.

**Solution:** `eslint-config-next` 16 was rewritten to natively support flat config — no FlatCompat needed:

```javascript
import nextVitals from "eslint-config-next/core-web-vitals"; // Native flat config ✅
```

**Lesson:** The JavaScript ecosystem moves fast. When a library throws a confusing internal error, always check if a new version of the library has native support for the feature you're trying to use. The official docs are the first place to look.

---

### Problem 3: Husky commit-msg Hook Failing with `Unknown option: 'no'`

**Error:**

```
ERROR  Unknown option: 'no'
husky - commit-msg script failed (code 1)
```

**Root cause:** The commit-msg hook used `npx --no --` syntax which is npm-specific. We're using pnpm.

**Solution:** Replace `npx --no -- commitlint` with `pnpm exec commitlint`:

```bash
# Wrong (npm syntax):
npx --no -- commitlint --edit $1

# Correct (pnpm syntax):
pnpm exec commitlint --edit $1
```

**Lesson:** Package manager commands are not interchangeable. `npx` = npm. `pnpm exec` = pnpm. Always use the command appropriate for your chosen package manager.

---

### Problem 4: `pnpx prisma init` Downloaded Prisma 7 Instead of Our Installed v6

**What happened:** Running `pnpx prisma init` downloaded Prisma 7.6.0 from the internet, ignoring our installed v6.

**Root cause:** `pnpx` = "download and run from internet". `pnpm exec` = "run from local node_modules".

**Solution:** Always use `pnpm exec prisma` for all Prisma commands:

```bash
# Wrong — downloads latest from internet:
pnpx prisma init

# Correct — uses installed version from node_modules:
pnpm exec prisma init
pnpm exec prisma migrate dev
pnpm exec prisma studio
```

**Lesson:** After deliberately pinning a package version, always use `pnpm exec` to run its CLI. This is true for ALL CLI tools (prisma, drizzle-kit, etc.).

---

### Problem 5: VS Code Prisma Extension Showing v7 Errors on v6 Schema

**Error (in VS Code, not terminal):**

```
The datasource property `url` is no longer supported in schema files.
Move connection URLs for Migrate to `prisma.config.ts`
```

**Root cause:** The VS Code Prisma extension auto-updated to use the Prisma 7 language server for schema validation, while the installed CLI is still v6. Two separate systems at different versions.

**Solution:** Add to `.vscode/settings.json`:

```json
{
  "prisma.prismaVersion": "6"
}
```

**Lesson:** The editor's language server and the installed CLI are different processes. Always trust `pnpm exec prisma validate` (the CLI) over VS Code red squiggles (the editor). The CLI is what actually runs your code.

---

### Problem 6: Prisma Cannot Find `DIRECT_DATABASE_URL`

**Error:**

```
Error code: P1012
error: Environment variable not found: DIRECT_DATABASE_URL.
```

**Root cause:** Prisma reads `.env`, not `.env.local`. The variable was in `.env.local` but not in `.env`.

**Solution:** Create a separate `.env` file (gitignored) with only the database URLs:

```bash
# .env — read by Prisma CLI
DATABASE_URL="postgresql://devuser:devpassword@localhost:5432/city_directory_dev"
DIRECT_DATABASE_URL="postgresql://devuser:devpassword@localhost:5432/city_directory_dev"
```

**Lesson:** Different tools read different env files. Know which file each tool reads:

- Prisma CLI → `.env`
- Next.js app → `.env.local` (overrides `.env`)
- Both → `.env` (but `.env.local` takes precedence in Next.js)

---

### Problem 7: `prisma.config.ts` Auto-Created — Causing False Errors

**What happened:** `pnpm exec prisma init` auto-created an empty `prisma.config.ts`. This confused the VS Code extension into thinking we're using Prisma 7 config system.

**Solution:** Delete it. Prisma 6 does not need `prisma.config.ts`:

```bash
rm prisma.config.ts
```

---

### Problem 8: shadcn Installed Files to Root Instead of `src/`

**What happened:** `npx shadcn@latest init` created `components/`, `lib/`, and `hooks/` at the project root, not inside `src/`.

**Root cause:** We chose `--yes` in `create-next-app` which did not create a `src/` folder by default. shadcn read this and installed to root.

**Solution:**

1. Manually moved folders to `src/` using Windows File Explorer (PowerShell permission issue prevented `mv` command)
2. Updated `components.json` aliases to point to `@/components`, `@/lib`, `@/hooks`

**Lesson:** When you configure a non-default project structure (src/ folder), you must also configure all dependent tools to follow that structure. Check each tool's config file after setup.

---

### Problem 9: Root Layout Missing `<html>` and `<body>` Tags

**Error:**

```
Runtime Error: Missing <html> and <body> tags in the root layout.
```

**Root cause:** Following next-intl's suggested pattern, we made `src/app/layout.tsx` return `{children}` directly without html/body tags. Next.js 16 requires html/body in the root layout.

**Solution:** Root layout has html/body. `[locale]/layout.tsx` wraps children only (no extra html/body):

```tsx
// src/app/layout.tsx — has html + body (Next.js requirement)
export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

// src/app/[locale]/layout.tsx — sets lang, dir, providers (NO html/body)
export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  // ... validation ...
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
```

**But to set lang and dir dynamically, use `generateStaticParams` + metadata:**
The locale-specific html attributes (`lang`, `dir`) are set via Next.js's `generateMetadata` or via a client component that sets them after hydration.

---

## 8. Key Decisions Log (Questions We Discussed)

### Decision 1: Auto-Approve Listings vs Manual Review

**Question:** Should new listings require admin approval before going live?

**Decision:** Auto-approve. Listings go live immediately with an "Unverified" badge.

**Rationale:** Manual review is a bottleneck. The badge informs users while allowing business owners to list immediately. Admins react to problems after the fact.

**Mitigations for abuse:**

- Rate limit: max 1 new listing per 24 hours per account
- Email verification required before creating listings
- Community flag system
- Admin can suspend listings and ban accounts

---

### Decision 2: Turbopack — Use It or Skip It?

**Question asked by junior:** "Turbopack seems important for faster development — why did you disable it?"

**Initial decision (wrong):** Disable Turbopack with `--no-turbopack`

**Corrected decision:** Enable Turbopack (omit the flag)

**Rationale:** Turbopack dev mode is fully stable in Next.js 15+. Next.js 16 makes it the default. Benefits: hot reload in ~150ms vs ~1.5s, cold start ~1.5s vs ~8s.

**Lesson for senior:** Always verify assumptions against current documentation. Next.js 16 changed this.

---

### Decision 3: `@latest` vs Pinned Version for `create-next-app`

**Question asked by junior:** "Why not just use `create-next-app@latest`?"

**Initial decision (wrong):** Pin to `@15`

**Corrected decision:** Use `@latest` (gets Next.js 16 — Active LTS)

**Rationale:** Starting a new project on a maintenance release (15.x) means upgrading to Active LTS (16.x) in 6 months. No reason to delay.

**Lesson:** Always check `endoflife.date/{technology}` before pinning a version.

---

### Decision 4: npm vs pnpm vs Bun

**Question asked by junior:** "Why not use pnpm or bun? They're faster."

**Decision:** Use pnpm

**Rationale:**

- pnpm: 3.4× faster than npm, zero compatibility issues, industry standard for monorepos
- Bun: fastest, but compatibility issues with some Prisma operations on Windows
- npm: no compelling reason to use in 2026

---

### Decision 5: Prisma 6 vs Prisma 7

**Decision:** Prisma 6

**Rationale:** Prisma 7 (November 2025) requires driver adapters — more setup, all online documentation references v6 patterns, and this is a learning project where minimizing unexpected breaking changes is valuable.

**Upgrade path:** Documented at `prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7`

---

### Decision 6: Geographic Scope

**Decision:** Single city (Al Nabik) at launch. URL: `/al-nabik/pharmacies/...`

**Architecture:** `Country → Region → City` hierarchy in database from Day 1. Adding a second city = zero code changes (one DB row).

**Principle:** Design for extension, not for the future. Don't build multi-city UI now (over-engineering). Do build the data model to support it.

---

### Decision 7: Business Verification — Two-Tier Trust System

**Decision:** Anyone can register. Listings show "Unverified" badge until admin verifies.

**Two tiers:**

- **Tier 0 (default):** Self-claimed. Live immediately with orange "غير موثق" badge.
- **Tier 1 (verified):** Admin contacts business, confirms information, grants blue "✓ موثق" badge.

**Rationale:** Serves the carpenter who has no certificate AND protects against fake professional listings. Creates incentive for business owners to cooperate with verification (they want the badge).

**Future:** Verification becomes a paid service. Infrastructure is already built.

---

### Decision 8: shadcn Radix vs Base UI

**Decision:** Radix UI

**Rationale:** Base UI released v1.0 in December 2025 — too new, small community, few tutorials. Radix has 4 years of production battle-testing.

---

### Decision 9: ESLint `.eslintrc.json` vs Flat Config

**What we learned:** ESLint 9 (which ships with Next.js 16) uses flat config (`eslint.config.mjs`). The old `.eslintrc.json` format is completely unsupported. Community tutorials written before 2025 show the old format.

**Key rule:** Always check ESLint's own docs for the current format, not tutorials.

---

## 9. Commands Reference

### Daily Development

```bash
# Start development server
pnpm dev

# Type checking (fast, no build)
pnpm type-check

# Lint source files
pnpm lint

# Format all files
pnpm format

# Check formatting without changing files
pnpm format:check
```

### Database (Prisma)

```bash
# ALWAYS use pnpm exec — never pnpx

# Validate schema
pnpm exec prisma validate

# Create and apply a new migration
pnpm exec prisma migrate dev --name your_migration_name

# Apply migrations (production — no new migration files)
pnpm exec prisma migrate deploy

# Open visual database browser
pnpm exec prisma studio

# Regenerate Prisma Client (after schema changes)
pnpm exec prisma generate

# Seed the database
pnpm exec prisma db seed

# Reset database (WARNING: deletes all data)
pnpm exec prisma migrate reset
```

### Docker

```bash
# Start Postgres + Redis
docker compose up -d

# Stop containers (data preserved)
docker compose down

# View container logs
docker compose logs -f

# Check container health
docker compose ps

# Nuclear reset (deletes all data)
docker compose down -v
```

### Git (Conventional Commits Required)

```bash
# Valid commit message format: type(scope): description
git commit -m "feat(auth): add Google OAuth provider"
git commit -m "fix(listings): correct slug for Arabic names"
git commit -m "chore(deps): upgrade Prisma to 6.19.2"
git commit -m "docs(readme): add setup instructions"
git commit -m "refactor(middleware): simplify RBAC check"
git commit -m "test(auth): add password hashing unit tests"

# Types: feat | fix | chore | docs | refactor | test | style | perf | ci
```

### Build & Deploy

```bash
# Production build
pnpm build

# Start production server locally
pnpm start
```

---

## 10. Environment Variables Reference

### `.env` (Prisma CLI only)

```bash
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
DIRECT_DATABASE_URL="postgresql://user:pass@host:5432/dbname"
```

### `.env.local` (Next.js app)

All variables from `.env.example` with real values. See `.env.example` for full documentation and descriptions.

### Variable naming convention

- `NEXT_PUBLIC_*` — exposed to browser (safe for public values only)
- Everything else — server-side only, never exposed to browser

---

## 11. What Comes Next

### Phase 1: Authentication System

**Goal:** User can sign up, verify email, sign in, reset password, sign out.

**Key files to create:**

- `src/lib/auth.ts` — Auth.js v5 configuration
- `src/lib/rate-limit.ts` — Rate limiting via Upstash Redis
- `src/middleware.ts` — Add auth checks to existing locale middleware
- `src/features/auth/actions.ts` — Server Actions for all auth operations
- `src/features/auth/schemas.ts` — Zod validation schemas
- `src/features/auth/utils.ts` — Password hashing, token generation
- `src/app/[locale]/(auth)/` — All auth pages

**Key packages to install:**

```bash
pnpm add next-auth@beta @auth/prisma-adapter bcryptjs
pnpm add -D @types/bcryptjs
```

**Before starting Phase 1:** Run `pnpm build` and confirm Phase 0 is fully complete. Never start a new phase on a failing build.

---

_This README is a living document. Update it after every significant decision, problem, or phase completion._

_Last updated: Phase 0 completion_
