# Phase 2: Database & Prisma Setup — Complete Reference

> **Who this document is for:** Any developer (including future-you) who wants to understand
> exactly what was built in Phase 2, why every decision was made, and how to reproduce it from scratch.
> Read this before touching any database model.

---

## Table of Contents

1. [What Phase 2 Delivers](#1-what-phase-2-delivers)
2. [Why a Dedicated Database Phase?](#2-why-a-dedicated-database-phase)
3. [Prisma Syntax Reference](#3-prisma-syntax-reference)
4. [The Complete Data Model](#4-the-complete-data-model)
5. [Model-by-Model Reference](#5-model-by-model-reference)
6. [Relation Map — How Tables Connect](#6-relation-map--how-tables-connect)
7. [PostgreSQL Extensions & GIN Indexes](#7-postgresql-extensions--gin-indexes)
8. [Audit Log System](#8-audit-log-system)
9. [Platform Settings Cache](#9-platform-settings-cache)
10. [Seed Data](#10-seed-data)
11. [Every Command Used in Phase 2](#11-every-command-used-in-phase-2)
12. [Mistakes We Hit & How We Fixed Them](#12-mistakes-we-hit--how-we-fixed-them)
13. [Phase 2 Done Criteria](#13-phase-2-done-criteria)

---

## 1. What Phase 2 Delivers

At the end of this phase, the database is fully built and ready for all future phases.

| Deliverable                                                                   | Status |
| ----------------------------------------------------------------------------- | ------ |
| 14 new database tables (all domain models)                                    | ✅     |
| `pg_trgm` trigram extension for Arabic search                                 | ✅     |
| `unaccent` extension for diacritic-insensitive search                         | ✅     |
| GIN indexes on `searchableText` and `nameAr`                                  | ✅     |
| `writeAuditLog()` helper in `src/lib/audit.ts`                                | ✅     |
| `getSetting()` with Redis caching in `src/features/platform/settings.ts`      | ✅     |
| Seed data: Syria → ريف دمشق → النبك, 10 categories, 1 super admin, 7 settings | ✅     |

---

## 2. Why a Dedicated Database Phase?

**The naive approach:** Create all 20+ tables in Phase 0 before writing any code.

**The problem with the naive approach:**

- Migrations get out of sync with the code that uses them
- You migrate tables for features that don't exist yet
- When you change a feature design, you also have to undo migrations

**Our approach (vertical slices):**

- Phase 1 created only the tables auth needed: `users`, `sessions`, `oauth_accounts`, token tables
- Phase 2 creates all remaining domain tables now that we know exactly what Phase 3–12 need
- Every migration is always in sync with the code that needs it

**The rule a senior engineer follows:**

> Never run a migration for a table until you are about to write the code that reads from or writes to that table.

---

## 3. Prisma Syntax Reference

Before reading the models, understand every annotation used:

### Field Annotations

| Annotation         | Meaning                                            | Example                              |
| ------------------ | -------------------------------------------------- | ------------------------------------ |
| `@id`              | This field is the primary key                      | `id String @id`                      |
| `@default(cuid())` | Auto-generate a unique ID on INSERT                | `id String @id @default(cuid())`     |
| `@default(now())`  | Set to current timestamp on INSERT                 | `createdAt DateTime @default(now())` |
| `@default(false)`  | Set boolean to false on INSERT                     | `isVerified Boolean @default(false)` |
| `@default(0)`      | Set integer to 0 on INSERT                         | `viewCount Int @default(0)`          |
| `@updatedAt`       | Prisma auto-sets this on every UPDATE              | `updatedAt DateTime @updatedAt`      |
| `@unique`          | PostgreSQL UNIQUE constraint — no duplicate values | `email String @unique`               |
| `@db.Text`         | Use PostgreSQL TEXT type (unlimited length)        | `descriptionAr String? @db.Text`     |
| `?` after type     | Column is nullable (can be NULL in DB)             | `nameEn String?`                     |

### Why `@db.Text` matters

Without `@db.Text`, Prisma maps a `String` to `VARCHAR(191)` — a 191-character limit.
For business descriptions, addresses, and audit log payloads, 191 characters is not enough.
`@db.Text` maps to PostgreSQL's `TEXT` type which stores up to 1 GB of text.

```prisma
// ❌ Capped at 191 characters — will silently truncate long descriptions
descriptionAr String?

// ✅ Unlimited length — correct for user-written content
descriptionAr String? @db.Text
```

### Model Annotations

| Annotation            | Meaning                                                       |
| --------------------- | ------------------------------------------------------------- |
| `@@id([a, b])`        | Composite primary key across two columns                      |
| `@@unique([a, b])`    | Composite unique constraint — combination must be unique      |
| `@@index([a])`        | B-tree index on one column                                    |
| `@@index([a, b])`     | Composite B-tree index on two columns                         |
| `@@map("table_name")` | The actual PostgreSQL table name (overrides Prisma's default) |

### Why `@@map()` on every model?

Prisma defaults to PascalCase table names (`BusinessProfile`). PostgreSQL convention is snake_case (`business_profiles`). We use `@@map()` on every model so:

- SQL queries look normal: `SELECT * FROM business_profiles`
- DBeaver/TablePlus shows readable table names
- Raw SQL migrations use the correct table names

### Relation Annotations

```prisma
// One-to-many relation: ONE User has MANY BusinessProfiles
// "ListingOwner" is the relation name — required when a model has
// multiple relations to the same target model

model User {
  ownedListings BusinessProfile[] @relation("ListingOwner")
}

model BusinessProfile {
  ownerId String
  owner   User   @relation("ListingOwner", fields: [ownerId], references: [id])
  //                                        ↑ foreign key    ↑ what it points to
}
```

| `onDelete` option | Meaning                                        |
| ----------------- | ---------------------------------------------- |
| `Cascade`         | Delete child rows when parent is deleted       |
| `SetNull`         | Set foreign key to NULL when parent is deleted |
| `Restrict`        | Block deletion of parent if children exist     |

**Rule:** Use `Cascade` when the child cannot exist without the parent (e.g. a phone number without a business). Use `SetNull` when you want to keep the child row but lose the reference (e.g. an audit log after a user is deleted).

---

## 4. The Complete Data Model

### All tables in the database after Phase 2

```
AUTH (Phase 1)                    DOMAIN (Phase 2)
──────────────────                ──────────────────────────────────────────
users                             countries
sessions                          regions
oauth_accounts                    cities
verification_tokens               categories
email_verification_tokens         subcategories
password_reset_tokens             business_profiles
                                  phone_numbers
                                  working_hours
                                  social_links
                                  media_files
                                  review_flags
                                  audit_logs      ← extended from Phase 1
                                  notifications
                                  platform_settings
```

### Entity Relationship Overview

```
countries (1)
  └── regions (many)
        └── cities (many)
              └── business_profiles (many)

categories (1)
  ├── subcategories (many)
  └── business_profiles (many)

users (1)
  ├── business_profiles [as owner] (many)
  ├── media_files [as uploader] (many)
  ├── review_flags [as reporter] (many)
  ├── notifications (many)
  └── audit_logs [as actor] (many)

business_profiles (1)
  ├── phone_numbers (many)
  ├── working_hours (7 — one per day)
  ├── social_links (many)
  ├── media_files (many)
  └── review_flags (many)
```

---

## 5. Model-by-Model Reference

---

### `Country`

**Table:** `countries`
**Purpose:** Top level of the geography hierarchy.

```prisma
model Country {
  id        String   @id @default(cuid())
  name      String   // "Syria" — English name
  nameAr    String   // "سوريا" — Arabic name
  code      String   @unique // ISO 3166-1 alpha-2, e.g. "SY"
  createdAt DateTime @default(now())

  regions Region[]

  @@map("countries")
}
```

**Why `code` is unique:** ISO country codes are globally unique by definition. `@unique` enforces this at the DB level — you cannot accidentally insert Syria twice.

**Why store both `name` and `nameAr`:**
The app is bilingual. Every geography entity stores both languages so we never need a translation JOIN — the name is always immediately available in whichever language the user requested.

---

### `Region`

**Table:** `regions`
**Purpose:** A subdivision of a country (governorate/province level).

```prisma
model Region {
  id        String   @id @default(cuid())
  name      String   // "Damascus Countryside"
  nameAr    String   // "ريف دمشق"
  countryId String   // Foreign key → countries.id

  country Country @relation(fields: [countryId], references: [id])
  cities  City[]

  @@index([countryId])
  @@map("regions")
}
```

**Why `@@index([countryId])`:** The query "get all regions for Syria" filters by `countryId`. Without an index, PostgreSQL scans every row. With a B-tree index, it jumps directly to Syria's regions.

---

### `City`

**Table:** `cities`
**Purpose:** A specific city within a region. The `slug` is used in URLs.

```prisma
model City {
  id       String  @id @default(cuid())
  name     String  // "Al Nabik"
  nameAr   String  // "النبك"
  slug     String  @unique // "al-nabik" — used in URL: /ar/al-nabik/...
  regionId String
  isActive Boolean @default(true) // false = city hidden from public UI

  @@index([regionId])
  @@index([slug])
  @@map("cities")
}
```

**Why `slug` and not `id` in URLs:**

- `/ar/al-nabik/pharmacies` is readable, shareable, and SEO-friendly
- `/ar/clx7abc123/pharmacies` reveals nothing to the reader or search engine
- Adding a new city = one DB row, zero code changes (Mental Model 3 from the architecture guide)

**Why `isActive`:**
If we launch a second city but it's not ready for public access, `isActive: false` hides it from the public directory without deleting any data.

---

### `Category`

**Table:** `categories`
**Purpose:** Top-level business classification (e.g. Pharmacies, Restaurants).

```prisma
model Category {
  id            String   @id @default(cuid())
  nameAr        String   // "صيدليات"
  nameEn        String   // "Pharmacies"
  slug          String   @unique // "pharmacies"
  descriptionAr String?
  descriptionEn String?
  icon          String?  // Lucide icon name: "pill", "utensils", "scissors"
  isVisible     Boolean  @default(true)
  displayOrder  Int      @default(0) // Controls sort order on the homepage
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  subcategories Subcategory[]
  listings      BusinessProfile[]

  @@index([slug])
  @@index([isVisible, displayOrder])
  @@map("categories")
}
```

**Why `displayOrder`:** Without this field, categories would sort by creation date or ID — neither meaningful to a user. `displayOrder` lets an admin reorder categories (Pharmacies first, General Services last) without changing the data.

**Why `@@index([isVisible, displayOrder])`:** The homepage query is `WHERE isVisible = true ORDER BY displayOrder ASC`. A composite index on both columns covers this query entirely — PostgreSQL never touches the table, only the index.

**Why `icon` stores a Lucide icon name (not a URL):**
An image URL can break (file deleted, CDN changes). A Lucide icon name like `"pill"` maps to a React component that will always render. Zero hosting cost, zero broken images.

---

### `Subcategory`

**Table:** `subcategories`
**Purpose:** Optional second level under a Category.

```prisma
model Subcategory {
  id           String   @id @default(cuid())
  nameAr       String
  nameEn       String
  slug         String   @unique
  categoryId   String
  isVisible    Boolean  @default(true)
  displayOrder Int      @default(0)

  category Category          @relation(fields: [categoryId], references: [id])
  listings BusinessProfile[]

  @@index([categoryId])
  @@map("subcategories")
}
```

**Why max two levels (Category → Subcategory):**
Three-level taxonomies are confusing to users. A business owner should be able to pick their category in two clicks maximum. "Pharmacies > 24-hour Pharmacies" is the right depth. "Pharmacies > Medical > 24-hour > Urban" is not.

---

### `BusinessProfile`

**Table:** `business_profiles`
**Purpose:** The core entity of the entire application. One row = one business listing.

```prisma
model BusinessProfile {
  id            String        @id @default(cuid())
  nameAr        String
  nameEn        String?
  slug          String        @unique
  descriptionAr String?       @db.Text  // ← @db.Text: unlimited length
  descriptionEn String?       @db.Text
  status        ListingStatus @default(DRAFT)

  // Verification
  isVerified   Boolean   @default(false)
  verifiedById String?   // Which admin verified this listing
  verifiedAt   DateTime?

  // Ownership
  ownerId String

  // Geography
  cityId    String
  addressAr String?
  addressEn String?
  latitude  Float?    // GPS coordinates for future map feature
  longitude Float?

  // Taxonomy
  categoryId    String
  subcategoryId String?

  // Media
  coverImageUrl String?
  logoImageUrl  String?

  // Search — THE most important field for search performance
  // Concatenation of: nameAr + " " + nameEn + " " + descriptionAr + " " + addressAr
  // Updated on every save by the updateListingAction server action
  // WHY denormalized? pg_trgm requires ONE column to index.
  searchableText String? @db.Text

  viewCount   Int       @default(0)
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime? // Soft delete — set instead of deleting the row
  deletedBy   String?   // Audit: who deleted this listing

  @@index([status])
  @@index([ownerId])
  @@index([cityId])
  @@index([categoryId])
  @@index([slug])
  @@index([deletedAt])
  @@index([publishedAt])
  @@index([status, deletedAt])
  @@map("business_profiles")
}
```

**Why soft delete (`deletedAt` instead of `DELETE`):**
When a listing is "deleted" we set `deletedAt = now()` instead of removing the row. Reasons:

1. The owner might have a complaint — we need the data to investigate
2. Audit logs reference `entityId` — a hard delete creates orphaned audit entries
3. Accidental deletion can be undone in under 30 seconds: `UPDATE SET deletedAt = NULL`

**Why `searchableText` is denormalized:**
`pg_trgm` GIN indexes work on a single column. We cannot index "nameAr OR descriptionAr OR addressAr" simultaneously. The solution: concatenate all searchable fields into one `searchableText` column and index that. It is updated on every save — a small write cost for a massive read benefit.

**Why `@@index([status, deletedAt])`:**
The most common query in the public directory is:

```sql
WHERE status = 'ACTIVE' AND "deletedAt" IS NULL
```

A composite index on both columns covers this filter in one index scan instead of two.

**The listing state machine:**

```
DRAFT ──(owner submits)──► ACTIVE ──(admin suspends)──► SUSPENDED
  ▲                           │                              │
  │                           │                              │
  └───(admin restores)────────┴──────────────────────────────┘
```

---

### `PhoneNumber`

**Table:** `phone_numbers`
**Purpose:** A business can have multiple phone numbers (landline, mobile, WhatsApp).

```prisma
model PhoneNumber {
  id         String   @id @default(cuid())
  businessId String
  number     String
  label      String?  // "واتساب", "موبايل", "هاتف ثابت"
  isPrimary  Boolean  @default(false)

  business BusinessProfile @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId])
  @@map("phone_numbers")
}
```

**Why `onDelete: Cascade`:** A phone number cannot exist without its business. When a listing is hard-deleted, all its phone numbers should be deleted too. Cascade does this automatically.

**Why separate table (not an array in BusinessProfile):**
PostgreSQL arrays cannot be individually indexed or queried efficiently. A separate table with an index on `businessId` is faster and more flexible.

---

### `WorkingHours`

**Table:** `working_hours`
**Purpose:** Opening/closing times for each day of the week.

```prisma
model WorkingHours {
  id         String    @id @default(cuid())
  businessId String
  dayOfWeek  DayOfWeek // Enum: MONDAY, TUESDAY, ... SUNDAY
  openTime   String?   // "09:00" — 24-hour format string
  closeTime  String?   // "22:00"
  isClosed   Boolean   @default(false) // true = closed this day

  @@unique([businessId, dayOfWeek]) // A business has exactly ONE entry per day
  @@index([businessId])
  @@map("working_hours")
}
```

**Why `@@unique([businessId, dayOfWeek])`:**
This prevents a bug where a business could accidentally have two Monday entries. The composite unique constraint means: "for a given business, each day of the week can appear at most once."

**Why store times as `String` ("09:00") and not `DateTime`:**
`DateTime` includes a date component, which is meaningless for recurring weekly hours. A string like `"09:00"` is simpler, timezone-safe, and trivial to display. No date math needed.

---

### `SocialLink`

**Table:** `social_links`
**Purpose:** Facebook, Instagram, WhatsApp, website links for a business.

```prisma
model SocialLink {
  id         String         @id @default(cuid())
  businessId String
  platform   SocialPlatform // Enum: FACEBOOK, INSTAGRAM, WHATSAPP, etc.
  url        String

  @@index([businessId])
  @@map("social_links")
}
```

**Why an enum for `platform`:**
An enum prevents garbage data. Without it, someone could store `platform: "facebok"` (typo) or `platform: "WhatsApp"` vs `platform: "whatsapp"` — inconsistent forever. The enum enforces valid values at the DB level.

---

### `MediaFile`

**Table:** `media_files`
**Purpose:** Photos and videos uploaded for a business listing.

```prisma
model MediaFile {
  id                 String      @id @default(cuid())
  businessId         String
  type               MediaType   // IMAGE or VIDEO
  cloudinaryPublicId String      @unique // Cloudinary's internal ID for this file
  url                String      // CDN delivery URL
  thumbnailUrl       String?     // Video thumbnail or image thumbnail
  status             MediaStatus @default(PENDING) // PENDING → APPROVED or REJECTED
  displayOrder       Int         @default(0)
  width              Int?
  height             Int?
  durationSeconds    Int?        // Videos only
  sizeBytes          Int?
  rejectionReason    String?     // Why admin rejected (shown to owner)
  uploadedById       String
  approvedAt         DateTime?

  @@index([businessId])
  @@index([status])
  @@index([type, status])  // For admin video moderation queue: WHERE type='VIDEO' AND status='PENDING'
  @@map("media_files")
}
```

**Why `cloudinaryPublicId @unique`:**
Cloudinary uses `public_id` to identify files. This unique constraint prevents the same file from being registered twice. It also gives us a reliable way to delete the file from Cloudinary when the DB row is deleted.

**Media approval flow:**

```
Upload file → MediaFile created (status: PENDING)
                    │
          ┌─────────┴──────────┐
     IMAGE file            VIDEO file
          │                    │
   Auto-approved        Admin must review
   (status: APPROVED)         │
                    ┌──────────┴──────────┐
               APPROVED               REJECTED
            (visible on         (owner notified,
             listing)            reason shown)
```

---

### `ReviewFlag`

**Table:** `review_flags`
**Purpose:** Citizens can report inaccurate or inappropriate listings.

```prisma
model ReviewFlag {
  id              String     @id @default(cuid())
  businessId      String
  reportedById    String?    // NULL = anonymous report (allowed)
  reason          String
  details         String?    @db.Text
  status          FlagStatus @default(PENDING) // PENDING → RESOLVED or IGNORED
  resolvedById    String?
  resolvedAt      DateTime?
  resolutionNotes String?

  @@index([businessId])
  @@index([status])
  @@map("review_flags")
}
```

**Why `reportedById` is nullable:**
We allow anonymous reports. A citizen who spots wrong information should not need to create an account to report it. `reportedById: null` = anonymous.

---

### `AuditLog`

**Table:** `audit_logs`
**Purpose:** Immutable record of every significant action in the system.

```prisma
model AuditLog {
  id             String      @id @default(cuid())
  actorId        String?     // NULL = system action (no logged-in user)
  actorEmail     String?     // Denormalized — email AT TIME OF ACTION
  actorRole      Role?       // Denormalized — role AT TIME OF ACTION
  action         AuditAction // What happened (enum)
  entityType     String      // "BusinessProfile", "User", "Category"
  entityId       String      // The ID of the affected row
  previousValues Json?       // State BEFORE the change
  newValues      Json?       // State AFTER the change
  ipAddress      String?
  createdAt      DateTime    @default(now()) // Append-only: no updatedAt

  actor User? @relation("ActorAuditLogs", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([actorId])
  @@index([entityType, entityId])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}
```

**Why `actorEmail` and `actorRole` are denormalized (duplicated):**
If a user is deleted, their User row is gone. But we still need the audit log to be readable — "Admin ahmed@... suspended listing X at 14:32." If we only stored `actorId`, the email would be unresolvable after deletion. Denormalizing captures the email **at the time of the action**, permanently.

**Why `onDelete: SetNull` (not Cascade) on the actor relation:**
If we used `Cascade`, deleting a user would delete all their audit logs — destroying the entire audit trail for that user. `SetNull` keeps every audit log but sets `actorId = NULL`. The log survives; the user does not.

**Why `previousValues` and `newValues` are `Json`:**
The shape of what changed varies by entity. A listing update might change `nameAr`. A user update might change `role`. Using `Json` (PostgreSQL JSONB) means we never need a migration when we start auditing new fields.

---

### `Notification`

**Table:** `notifications`
**Purpose:** In-app notification center for business owners.

```prisma
model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType // LISTING_PUBLISHED, VIDEO_REJECTED, etc.
  title     String
  message   String           @db.Text
  isRead    Boolean          @default(false)
  data      Json?            // { listingId: "...", listingName: "..." }
  sentAt    DateTime?        // NULL = email not sent yet
  createdAt DateTime         @default(now())

  @@index([userId, isRead])   // For unread badge: COUNT WHERE userId=X AND isRead=false
  @@index([userId, createdAt]) // For notification list: ORDER BY createdAt DESC
  @@map("notifications")
}
```

**Why `@@index([userId, isRead])`:**
The notification bell badge runs a `COUNT` query on every page load:

```sql
SELECT COUNT(*) FROM notifications WHERE "userId" = '...' AND "isRead" = false
```

Without this composite index, this query scans every notification for every page load for every user. With the index, it is O(1).

---

### `PlatformSetting`

**Table:** `platform_settings`
**Purpose:** Runtime configuration that admins can change without a code deploy.

```prisma
model PlatformSetting {
  id          String   @id @default(cuid())
  key         String   @unique // "max_photos", "max_videos", etc.
  value       String            // Always stored as string, parsed on read
  description String?
  updatedById String?
  updatedAt   DateTime @updatedAt

  @@index([key])
  @@map("platform_settings")
}
```

**Why every value is a `String`:**
A single type for all settings keeps the table simple. Callers parse as needed:

- `getSettingNumber("max_photos", 10)` → parses to `Int`
- `getSettingBoolean("maintenance_mode", false)` → parses to `Boolean`

**The 7 default settings:**

| Key                          | Value   | Used By                      |
| ---------------------------- | ------- | ---------------------------- |
| `max_photos`                 | `10`    | Upload handler, listing form |
| `max_videos`                 | `3`     | Upload handler, listing form |
| `max_listings_per_owner`     | `3`     | createListingAction          |
| `max_video_size_mb`          | `100`   | Upload validation            |
| `max_video_duration_seconds` | `300`   | Upload validation (5 min)    |
| `pdf_cache_ttl_seconds`      | `21600` | PDF export (6 hours)         |
| `listing_rate_limit_per_day` | `1`     | Rate limiter                 |

---

## 6. Relation Map — How Tables Connect

### One-to-Many Relations

```
Country  ──(1:many)──►  Region  ──(1:many)──►  City  ──(1:many)──►  BusinessProfile
                                                                            │
                                              Category  ──(1:many)──►  ────┤
                                                   │                       │
                                            Subcategory ──(1:many)──►  ────┤
                                                                            │
                                                 User  ─[owner]──(1:many)──┤
                                                                            │
                                              ┌─────────────────────────── ┤
                                              │                             │
                                        PhoneNumber                   WorkingHours
                                        SocialLink                    MediaFile
                                        ReviewFlag
```

### Many-to-One Relations (Foreign Keys)

| Child Table         | Foreign Key     | Points To              |
| ------------------- | --------------- | ---------------------- |
| `regions`           | `countryId`     | `countries.id`         |
| `cities`            | `regionId`      | `regions.id`           |
| `business_profiles` | `ownerId`       | `users.id`             |
| `business_profiles` | `cityId`        | `cities.id`            |
| `business_profiles` | `categoryId`    | `categories.id`        |
| `business_profiles` | `subcategoryId` | `subcategories.id`     |
| `business_profiles` | `verifiedById`  | `users.id`             |
| `phone_numbers`     | `businessId`    | `business_profiles.id` |
| `working_hours`     | `businessId`    | `business_profiles.id` |
| `social_links`      | `businessId`    | `business_profiles.id` |
| `media_files`       | `businessId`    | `business_profiles.id` |
| `media_files`       | `uploadedById`  | `users.id`             |
| `review_flags`      | `businessId`    | `business_profiles.id` |
| `review_flags`      | `reportedById`  | `users.id` (nullable)  |
| `review_flags`      | `resolvedById`  | `users.id` (nullable)  |
| `audit_logs`        | `actorId`       | `users.id` (nullable)  |
| `notifications`     | `userId`        | `users.id`             |
| `platform_settings` | `updatedById`   | `users.id` (nullable)  |

---

## 7. PostgreSQL Extensions & GIN Indexes

### Why `pg_trgm`?

A **trigram** is any 3-character sequence within a word.
The word `محمد` produces the trigrams: `مح`, `حم`, `محم`, `حمد`, `مد`, `محمد`.

When you search for `محم`, PostgreSQL compares your query's trigrams against the indexed trigrams and returns matches by similarity. This means:

- **Partial matches work:** `محم` finds `محمد`
- **Typo tolerance is free:** `مخمد` (wrong letter) still finds `محمد` (similarity score > threshold)
- **Arabic works perfectly:** trigrams are character-based — no language dictionary needed

**Without `pg_trgm`:**

```sql
-- Full table scan — O(n) — gets slower as listings grow
SELECT * FROM business_profiles WHERE "searchableText" ILIKE '%محمد%'
-- At 10,000 rows: 40ms. At 100,000 rows: 400ms. Unusable.
```

**With `pg_trgm` + GIN index:**

```sql
-- Index scan — O(log n) — constant time regardless of table size
SELECT * FROM business_profiles WHERE "searchableText" % 'محمد'
-- At 10,000 rows: 1ms. At 100,000 rows: 1ms. Always fast.
```

### Why `unaccent`?

Enables diacritic-insensitive search. A user typing `محمد` will find listings stored as `محمّد` (with shadda). Without unaccent, these are treated as different strings.

### Why GIN over GiST?

Two index types support `pg_trgm`:

| Index    | Read speed | Write speed | Best for              |
| -------- | ---------- | ----------- | --------------------- |
| **GIN**  | ⚡ Faster  | 🐢 Slower   | Read-heavy workloads  |
| **GiST** | 🐢 Slower  | ⚡ Faster   | Write-heavy workloads |

A business directory is read 100× more than it is written to. A listing is created once and searched thousands of times. **GIN is the correct choice.**

### The Migration SQL

```sql
-- File: prisma/migrations/[timestamp]_add_search_extensions/migration.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- GIN index on the full searchable text (all fields concatenated)
CREATE INDEX IF NOT EXISTS idx_bp_search_gin
  ON business_profiles
  USING GIN ("searchableText" gin_trgm_ops);

-- GIN index on Arabic name only (for autocomplete / name-only searches)
CREATE INDEX IF NOT EXISTS idx_bp_name_ar_gin
  ON business_profiles
  USING GIN ("nameAr" gin_trgm_ops);

-- Partial B-tree index for the public directory query
-- WHERE status = 'ACTIVE' AND "deletedAt" IS NULL ORDER BY "publishedAt" DESC
CREATE INDEX IF NOT EXISTS idx_bp_active_published
  ON business_profiles (status, "deletedAt", "publishedAt" DESC)
  WHERE "deletedAt" IS NULL;
```

> ⚠️ **Column name casing:** Prisma stores camelCase field names as quoted identifiers in PostgreSQL.
> `searchableText` in Prisma → `"searchableText"` in SQL (with quotes, case-sensitive).
> `searchable_text` (no quotes, snake_case) would fail — the column does not exist.

---

## 8. Audit Log System

**File:** `src/lib/audit.ts`

### The `writeAuditLog()` Function

```typescript
export function writeAuditLog(params: AuditParams): void {
  // Deliberately NOT awaited — fire-and-forget
  prisma.auditLog.create({ data: params }).catch((err) => {
    console.error("[AuditLog] Write failed:", err);
  });
}
```

**Why `void` return type (not `Promise<void>`):**
The function is intentionally not async. Callers do NOT await it. Audit logging must never block the main operation. If the audit write fails, the user's action still completes successfully. Losing one audit entry is acceptable; blocking a business owner from saving their listing is not.

**Usage pattern in server actions:**

```typescript
// In updateListingAction:
await prisma.businessProfile.update({ where: { id }, data: updates });

// After the update succeeds, log it — fire and forget
writeAuditLog({
  actorId: session.user.id,
  actorEmail: session.user.email,
  actorRole: session.user.role,
  action: AuditAction.LISTING_UPDATED,
  entityType: "BusinessProfile",
  entityId: id,
  previousValues: prev,
  newValues: next,
});

return { success: true }; // Does NOT wait for audit log
```

### The `buildDiff()` Helper

```typescript
export function buildDiff<T>(before: T, updates: Partial<T>) {
  // Returns only the fields that actually changed
  // Example:
  //   before:  { nameAr: "Old", status: "DRAFT", viewCount: 0 }
  //   updates: { nameAr: "New", status: "ACTIVE" }
  //   result:  { prev: { nameAr: "Old", status: "DRAFT" },
  //              next: { nameAr: "New", status: "ACTIVE" } }
}
```

This keeps audit logs small and readable. A diff of 2 changed fields is stored instead of the entire 20-field object.

---

## 9. Platform Settings Cache

**File:** `src/features/platform/settings.ts`

### Cache Flow

```
Request arrives
      │
      ▼
getSetting("max_photos")
      │
      ├─► Check Redis: key "setting:max_photos"
      │         │
      │    ┌────┴─────┐
      │  HIT (fast)  MISS (cold start or TTL expired)
      │    │             │
      │    │             ▼
      │    │     Query PostgreSQL
      │    │     platform_settings WHERE key = "max_photos"
      │    │             │
      │    │             ▼
      │    │     Store in Redis with TTL=300s
      │    │             │
      └────┴─────────────┘
                  │
                  ▼
           Return "10"
```

### The Type Coercion Bug (Fixed)

Upstash Redis automatically deserializes JSON values on read. If you store the string `"10"`, Redis returns the **number** `10`. Without coercion, `parseInt("10")` works but `"10" === "10"` would become `10 === "10"` → `false`.

```typescript
// ❌ Bug: cached could be number 10, not string "10"
const cached = await redis.get<string>(cacheKey);
if (cached !== null) return cached;

// ✅ Fixed: always coerce to string on read
const cached = await redis.get(cacheKey);
if (cached !== null && cached !== undefined) return String(cached);
```

### SETTING_KEYS Constants

```typescript
export const SETTING_KEYS = {
  MAX_PHOTOS: "max_photos",
  MAX_VIDEOS: "max_videos",
  MAX_LISTINGS_PER_OWNER: "max_listings_per_owner",
  // ...
} as const;
```

WHY: Prevents typos. `getSetting(SETTING_KEYS.MAX_PHOTOS)` catches `"max_photo"` (missing s) at compile time. `getSetting("max_photos")` only catches it at runtime (a bug in production).

---

## 10. Seed Data

**File:** `prisma/seed.ts`

### What Gets Seeded

**Geography:**

```
Syria (SY)
  └── ريف دمشق (Damascus Countryside)
        └── النبك — slug: "al-nabik"
```

**10 Categories:**

| Arabic       | English            | Slug               | Icon            |
| ------------ | ------------------ | ------------------ | --------------- |
| صيدليات      | Pharmacies         | pharmacies         | pill            |
| عيادات       | Clinics            | clinics            | stethoscope     |
| مطاعم        | Restaurants        | restaurants        | utensils        |
| محلات بقالة  | Groceries          | groceries          | shopping-basket |
| ورش ميكانيك  | Auto Repair        | auto-repair        | wrench          |
| مخابز        | Bakeries           | bakeries           | wheat           |
| صالونات      | Salons             | salons             | scissors        |
| محلات ملابس  | Clothing           | clothing           | shirt           |
| أدوات بناء   | Building Materials | building-materials | hard-hat        |
| خدمات متنوعة | General Services   | general-services   | briefcase       |

**Super Admin:**

- Email: `admin@city-directory.local`
- Password: `Admin@123456`
- Role: `SUPER_ADMIN`
- `emailVerified`: pre-set to now (no email verification flow needed)

### Why Seed Uses `upsert` (Not `create`)

```typescript
await prisma.country.upsert({
  where: { code: 'SY' },
  update: {},     // Do nothing if already exists
  create: { ... } // Only create if missing
})
```

`upsert` makes the seed **idempotent** — running it 10 times produces the same result as running it once. This is critical because:

- `migrate reset` re-runs the seed automatically
- A developer might run `prisma db seed` twice by mistake
- `create` would throw a unique constraint error on the second run; `upsert` silently skips

---

## 11. Every Command Used in Phase 2

```bash
# Install ts-node (needed to run prisma/seed.ts directly)
pnpm add -D ts-node

# Apply schema changes as a new named migration
pnpm exec prisma migrate dev --name add_all_domain_models

# Create an EMPTY migration file for hand-written SQL (--create-only = don't apply yet)
pnpm exec prisma migrate dev --name add_search_extensions --create-only

# Apply all pending migrations (including the hand-edited SQL file)
pnpm exec prisma migrate dev

# Run the seed script (reads "prisma.seed" from package.json)
pnpm exec prisma db seed

# Open visual DB browser at http://localhost:5555
pnpm exec prisma studio

# Wipe the database and replay all migrations from scratch (dev only)
pnpm exec prisma migrate reset

# Check migration status — shows which are applied vs pending
pnpm exec prisma migrate status

# Regenerate Prisma Client after schema changes
pnpm exec prisma generate
```

### Why `pnpm exec prisma` and NOT `pnpx prisma`

| Command            | What it uses                                    | Risk                              |
| ------------------ | ----------------------------------------------- | --------------------------------- |
| `pnpm exec prisma` | Your installed version in `node_modules` (v6.x) | ✅ Safe                           |
| `pnpx prisma`      | Downloads LATEST from internet                  | ❌ Would get v7, breaking changes |

This project deliberately uses Prisma 6. `pnpx` would silently upgrade to v7 which has a completely different API.

---

## 12. Mistakes We Hit & How We Fixed Them

### Mistake 1 — AuditAction enum values removed

**What happened:** Phase 2 schema removed `USER_CREATED`, `EMAIL_VERIFIED`, `PASSWORD_RESET` from the `AuditAction` enum. PostgreSQL **cannot remove enum values** in a standard transaction — it aborts the entire migration.

**Fix:** Keep all Phase 1 enum values. Only ADD new values, never remove.

```prisma
// ✅ Correct — Phase 1 values kept, Phase 2 values added below
enum AuditAction {
  USER_CREATED    // Phase 1 — do not remove
  EMAIL_VERIFIED  // Phase 1 — do not remove
  PASSWORD_RESET  // Phase 1 — do not remove
  LISTING_CREATED // Phase 2 addition
  // ...
}
```

### Mistake 2 — Broken migration folder left on disk after error

**What happened:** A failed migration left a folder in `prisma/migrations/`. When `migrate reset` was run, it tried to replay the broken SQL and failed again.

**Fix:** Delete the broken migration folder before running `migrate reset`:

```bash
rm -rf prisma/migrations/[broken_timestamp]_migration_name
pnpm exec prisma migrate reset
```

### Mistake 3 — Raw SQL used snake_case column names

**What happened:** GIN index SQL used `searchable_text` but Prisma created the column as `"searchableText"` (camelCase, quoted).

**Fix:** Always use quoted camelCase in raw SQL:

```sql
-- ❌ Wrong
USING GIN (searchable_text gin_trgm_ops)

-- ✅ Correct
USING GIN ("searchableText" gin_trgm_ops)
```

### Mistake 4 — Redis returns number, not string

**What happened:** Upstash auto-deserializes JSON. Storing `"10"` returns `10` (number). The `getSetting()` function returned a number where callers expected a string.

**Fix:** Always coerce Redis reads to string:

```typescript
const cached = await redis.get(cacheKey);
if (cached !== null && cached !== undefined) return String(cached);
```

---

## 13. Phase 2 Done Criteria

```
✅  pnpm exec prisma studio shows all tables populated with seed data
✅  pg_trgm extension is active
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'; → 1 row
✅  GIN index exists on business_profiles."searchableText"
      SELECT indexname FROM pg_indexes WHERE tablename = 'business_profiles';
✅  getSetting("max_photos") returns "10" from Redis on second call
✅  pnpm type-check passes with zero errors
✅  pnpm build passes with zero errors
```

---

_Phase 2 complete. Next: Phase 3 — Category CMS (admin can create/edit/reorder categories end-to-end)._
