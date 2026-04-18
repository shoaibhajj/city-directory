# 1. OBJECTIVE
Implement Phase 7: Admin Panel - giving admins full visibility and control over listings, users, flags, audit logs, and platform settings.

# 2. CONTEXT SUMMARY
This is an Arabic-first city business directory built with Next.js 16.2.1, Prisma 6.x, and Redis caching. Phase 7 adds:
- Admin metrics dashboard with counts and charts
- Listings management (view, suspend, restore, verify)
- Users management (ban, unban, change role)
- Flags queue with resolution
- Audit log viewer
- Platform settings editor

KEY EXISTING COMPONENTS:
- Admin layout already has session + role check redirects (ADMIN, SUPER_ADMIN)
- writeAuditLog is fire-and-forget from lib/audit.ts
- sendNotification is fire-and-forget from notifications/sender.ts  
- Platform settings has invalidateAllSettings() from platform/settings.ts
- prisma schema has User.bannedAt, User.bannedReason fields

# 3. APPROACH OVERVIEW
1. Create admin/queries.ts with getAdminMetrics() function
2. Create admin/actions.ts with all server actions (suspend, restore, verify, ban, etc.)
3. Build admin pages: dashboard, listings, users, flags, audit-log, settings
4. Add force-dynamic to all admin pages (they read live DB data)
5. Run all verification steps (lint, type-check, build)

# 4. IMPLEMENTATION STEPS

## Step 1: Create admin/queries.ts
**File:** `src/features/admin/queries.ts`
**Goal:** Fetch admin metrics with Redis caching

```typescript
export interface AdminMetrics {
  activeListings: number;
  draftListings: number;
  suspendedListings: number;
  newUsersThisWeek: number;
  unresolvedFlags: number;
  pendingVideos: number;
  listingsPerCategory: { categoryId: string; nameAr: string; count: number }[];
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  // Cache in Redis with key "admin:metrics" TTL 60 seconds
  // Count ACTIVE/DRAFT/SUSPENDED listings
  // Count users createdAt >= 7 days ago
  // Count flags where resolved is not true
  // Count mediaFiles where status = PENDING and type = VIDEO
  // Count listings per category groupBy
}
```

## Step 2: Create admin/actions.ts
**File:** `src/features/admin/actions.ts`
**Goal:** All admin server actions with role checks

```typescript
// All actions must:
// - Call getServerSession() and verify role is ADMIN or SUPER_ADMIN  
// - Write audit log via writeAuditLog() after every mutation
// - Invalidate relevant Redis cache keys
// - Call revalidatePath() on affected pages

export async function suspendListingAction(listingId: string, reason: string)
export async function restoreListingAction(listingId: string)
export async function grantVerificationAction(listingId: string) 
export async function revokeVerificationAction(listingId: string)
export async function bulkSuspendAction(listingIds: string[], reason: string)
export async function banUserAction(userId: string, reason: string)
export async function unbanUserAction(userId: string)
export async function changeUserRoleAction(userId: string, newRole: Role)
export async function resolveFlagAction(flagId: string, resolution: string, actionTaken: string)
```

## Step 3: Create Admin Dashboard page
**File:** `src/app/[locale]/(admin)/admin/page.tsx`
**Goal:** Metrics overview with stat cards

- Force dynamic (export const dynamic = 'force-dynamic')
- Read getAdminMetrics()
- Stat cards: Active, Draft, Suspended, New Users (week), Flags, Videos
- Quick links to Listings, Users, Flags pages

## Step 4: Create Listings Management page
**File:** `src/app/[locale]/(admin)/admin/listings/page.tsx`
**Goal:** Browse and filter all listings

- Force dynamic
- Filter tabs: All / Active / Draft / Suspended (via searchParams)
- Search input: filter by nameAr or owner email  
- Table: Name, Category, City, Owner, Status, Views, Published, Actions
- Bulk select + suspend

## Step 5: Create Listing Detail page
**File:** `src/app/[locale]/(admin)/admin/listings/[id]/page.tsx`
**Goal:** Full listing view with moderation actions

- Force dynamic
- Tabs: Details, Media, Flags, Audit Log  
- Action buttons: Suspend, Restore, Grant Verification, Revoke Verification
- Confirmation dialogs using shadcn AlertDialog

## Step 6: Create Users Management page  
**File:** `src/app/[locale]/(admin)/admin/users/page.tsx`
**Goal:** Browse users with admin actions

- Force dynamic
- Search by name or email
- Table: Name, Email, Role, Date, Listings, Banned, Actions
- Actions: Ban, Unban, Change Role (SUPER_ADMIN only)

## Step 7: Create User Detail page
**File:** `src/app/[locale]/(admin)/admin/users/[id]/page.tsx`
**Goal:** User profile with their listings

- Force dynamic
- User details
- All listings by this user
- Ban/Unban button

## Step 8: Create Flags Queue page
**File:** `src/app/[locale]/(admin)/admin/flags/page.tsx`
**Goal:** Moderate flagged content

- Force dynamic
- Filter tabs: Unresolved / Resolved / All
- Table: Listing, Reason, Reporter, Date, Status
- Resolve action with confirmation dialog

## Step 9: Create Audit Log page
**File:** `src/app/[locale]/(admin)/admin/audit-log/page.tsx`
**Goal:** View full audit trail

- Force dynamic
- Filters: actor, entity type, action, date range
- Table: Timestamp, Actor, Role, Action, Entity
- Expandable row shows JSON diff

## Step 10: Create Settings page
**File:** `src/app/[locale]/(admin)/admin/settings/page.tsx`
**Goal:** Edit platform settings

- Force dynamic
- SUPER_ADMIN only (redirect ADMIN)
- Form with inputs for all PlatformSetting keys
- On save: update DB + call invalidateAllSettings()

## Step 11: Update i18n messages  
**Files:** `src/messages/ar.json` and `src/messages/en.json`
**Goal:** Add admin-specific translations

- Add admin namespace with:
  - dashboard, listings, users, flags, auditLog, settings
  - Status badges (active, draft, suspended)
  - Action labels

# 5. TESTING AND VALIDATION
- [ ] Admin can view metrics dashboard
- [ ] Admin can suspend a listing -> it disappears from public
- [ ] Admin can restore a listing -> it reappears
- [ ] Admin can grant verification -> badge appears  
- [ ] Admin can ban user -> sessions deleted, listings suspended
- [ ] Audit log shows every action
- [ ] Admin accessing settings redirect for non-SUPER_ADMIN
- [ ] `pnpm lint && pnpm type-check && pnpm build` all pass
