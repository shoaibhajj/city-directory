# Phase 5 — Media Upload System

**Status:** ✅ Complete  
**Completed:** April 2026  
**Complexity:** High  
**Estimated Time:** 5–7 days  
**Dependencies:** Phase 0–4

---

## Table of Contents

1. [Goal](#goal)
2. [Architecture: The Two-Phase Upload Design](#architecture-the-two-phase-upload-design)
3. [Dependencies Installed](#dependencies-installed)
4. [Prisma Schema Changes](#prisma-schema-changes)
5. [Cloudinary SDK Wrapper](#cloudinary-sdk-wrapper)
6. [Image Processing Pipeline](#image-processing-pipeline)
7. [Magic Bytes Validation](#magic-bytes-validation)
8. [Server Actions](#server-actions)
9. [Upload UI Components](#upload-ui-components)
10. [Admin Video Moderation Queue](#admin-video-moderation-queue)
11. [Public Profile Page Updates](#public-profile-page-updates)
12. [Notification Stub for Phase 9](#notification-stub-for-phase-9)
13. [i18n Messages](#i18n-messages)
14. [Files Created / Modified](#files-created--modified)
15. [Done Criteria Verification](#done-criteria-verification)
16. [Key Decisions Log](#key-decisions-log)

---

## Goal

Business owners can upload a cover image, logo, photo gallery, and videos for
their listing. Images are auto-processed server-side (EXIF stripped, resized,
converted to WebP). Videos wait for admin approval before appearing publicly.
The system must reject malicious files — including renamed executables — even if
their extension looks legitimate.

---

## Architecture: The Two-Phase Upload Design

This is the most important architectural decision in Phase 5. Understanding WHY
we chose this pattern prevents future engineers from "simplifying" it incorrectly.

### The Naive Approach (What We Did NOT Do)

Browser → POST /api/upload (with file in body) → Server → Cloudinary

text

**Why this fails on Vercel:**  
Vercel's serverless Lambda functions have a **4.5 MB request body limit** on the
Hobby plan. A single 10 MB photo would fail with HTTP 413. A 500 MB video would
never complete. Routing files through the server is the wrong model for a
serverless deployment.

### The Two-Phase Design (What We Built)

Phase A — Client uploads directly to Cloudinary:

1. Browser calls generatePresignedUrlAction(listingId, type)
   → auth check (is user logged in?)
   → ownership check (does this user own this listing?)
   → count limit check (have they hit the photo/video cap?)
   → create MediaFile(status=PENDING) in DB — the "claimed slot"
   → return signed upload parameters + mediaFileId

2. Browser XHR → POST to Cloudinary API directly
   → tracks upload progress with XMLHttpRequest.upload events
   → receives cloudinaryPublicId on success

Phase B — Server validates and processes:

3. Browser calls confirmUploadAction(mediaFileId, cloudinaryPublicId, resourceType)
   IMAGES:
   → fetch raw file from Cloudinary CDN (no body size limit — it's a GET)
   → validateImageFile() — magic bytes check (blocks exe/malware)
   → processImage() — Sharp: strip EXIF + auto-orient + resize + WebP
   → generateThumbnail() — 400×300 WebP
   → uploadBuffer() — processed WebP back to Cloudinary (replaces raw)
   → delete original raw upload from Cloudinary
   → update DB: url, thumbnailUrl, width, height, status=APPROVED
   → if COVER/LOGO: update businessProfile.coverImageUrl / logoImageUrl

VIDEOS:
→ getVideoMetadata() from Cloudinary API
→ check duration ≤ max_video_duration_seconds (from PlatformSetting)
→ update DB: url, thumbnailUrl, duration, status=PENDING
→ notify all admin users (fire-and-forget)

text

### WHY use XHR instead of fetch() for the Cloudinary upload?

`XMLHttpRequest` exposes `upload.onprogress` events, which give us byte-level
progress data. The browser's `fetch()` API does **not** expose upload progress —
there is no `onUploadProgress` equivalent in the Fetch standard as of 2026.
XHR is the correct choice here, not a legacy holdover.

### WHY re-upload the processed image instead of transforming via Cloudinary URL?

Cloudinary URL transformations happen at delivery time (on the CDN edge). They
do not strip EXIF data from the stored original — they just hide it in the
delivered response. If someone with your Cloudinary API key fetches the original,
the EXIF (including GPS coordinates) is still there.

By running Sharp server-side and **replacing** the original with the processed
version, we guarantee that the EXIF-containing file never persists anywhere in
our infrastructure. The stored file is clean. This is the privacy-correct approach.

### WHY create the DB record in Phase A, not Phase B?

Creating `MediaFile(status=PENDING)` in `generatePresignedUrlAction` serves two
purposes:

1. **Slot claiming:** It enforces upload limits atomically. Without a DB record,
   two concurrent uploads could both pass the "count < max" check and both
   create records, exceeding the limit by 1.

2. **Orphan tracking:** If the browser crashes after uploading to Cloudinary but
   before calling `confirmUploadAction`, the PENDING record exists in the DB. A
   future cleanup job can find MediaFile records stuck in PENDING for > 1 hour,
   call `deleteAsset()` on their cloudinaryPublicId (if set), and delete the record.

---

## Dependencies Installed

```bash
pnpm add cloudinary sharp react-dropzone react-image-crop
pnpm add -D @types/react-image-crop
```

| Package            | Version   | Why This                                                                                        |
| ------------------ | --------- | ----------------------------------------------------------------------------------------------- |
| `cloudinary`       | Latest v2 | Official Node.js SDK — typed, handles signing, streaming uploads                                |
| `sharp`            | Latest    | Fastest Node.js image processing library, uses native libvips, works on Vercel Lambda (Node 20) |
| `react-dropzone`   | Latest    | Headless drag-and-drop for React — we own all the UI, no style conflicts                        |
| `react-image-crop` | Latest    | Lightweight crop UI, no canvas manipulation complexity — we do the actual crop                  |

**WHY `sharp` specifically, not `jimp` or `canvas`?**  
Sharp uses native C++ bindings to libvips, which makes it 10–50× faster than
pure-JavaScript alternatives. For a server that might process 100 image uploads
per hour, this difference is significant. Vercel's Lambda runtime ships libvips
natively — no extra configuration needed. It will **NOT** work on Edge Runtime
(no native modules). Our Server Actions run on the Lambda runtime, so we are safe.

---

## Prisma Schema Changes

**Migration name:** `phase5-media-fields`

### Changes to `MediaFile` model

Added fields that were missing from the Phase 2 schema:
durationSeconds Float? — video duration (Float not Int — can be 90.5 seconds)
mimeType String? — detected MIME type after magic bytes validation
thumbnailUrl String? — Cloudinary URL of the 400×300 thumbnail
rejectionReason String? — admin's reason when rejecting a video
reviewedById String? — which admin approved/rejected
reviewedAt DateTime? — when the review happened

text

WHY `durationSeconds` is `Float` and not `Int`:  
A video can be 90.5 seconds long. Storing 90 would lose half a second of
precision, which matters when displaying "1:30" vs "1:31" in the UI.

### Changes to `BusinessProfile` model

Added four denormalized fields:
coverImageId String? — ID of the active cover MediaFile
coverImageUrl String? — Cloudinary URL (denormalized for fast reads)
logoImageId String? — ID of the active logo MediaFile
logoImageUrl String? — Cloudinary URL (denormalized for fast reads)

text

**WHY denormalize these URLs onto `BusinessProfile`?**  
The public profile page (`/ar/[citySlug]/[categorySlug]/[businessSlug]`) is
rendered by 99% of all page requests. Every render needs the cover and logo URLs.
Without denormalization, every page render runs:

```sql
SELECT url FROM media_files
WHERE business_profile_id = ? AND type IN ('COVER', 'LOGO') AND status = 'APPROVED'
LIMIT 1
```

With denormalization, it's just a column on the row we already fetched. One query
instead of three. For a page that might serve 10,000 requests per day, this matters.

The trade-off: when a cover image is updated, we must also update
`businessProfile.coverImageUrl`. This happens inside `confirmUploadAction` in a
single DB call — acceptable complexity for the performance gain.

**WHY store as plain `String?` instead of a foreign key relation to `MediaFile`?**  
A circular FK constraint between `BusinessProfile` and `MediaFile` creates a
dependency loop that PostgreSQL cannot resolve without `DEFERRABLE` constraints,
which Prisma 6 does not support. Storing the ID as a plain string and enforcing
referential integrity inside the Server Action is the pragmatic solution.

### New `AuditAction` enum values

UPLOAD_MEDIA
DELETE_MEDIA
APPROVE_MEDIA
REJECT_MEDIA

text

### New `NotificationType` enum values

VIDEO_PENDING_REVIEW
VIDEO_APPROVED
VIDEO_REJECTED

text

---

## Cloudinary SDK Wrapper

**File:** `src/features/media/cloudinary.ts`

Wraps the Cloudinary v2 SDK into four typed functions used by Server Actions:

### `generateUploadSignature(folder, publicId)`

Creates signed upload parameters for direct browser-to-Cloudinary uploads.

**WHY sign uploads instead of using unsigned presets?**  
An unsigned preset allows anyone who knows your cloud name to upload unlimited
files to your Cloudinary account. The upload form in a browser is visible to
anyone who opens DevTools. With signed uploads, each upload is tied to a specific
`folder` and `public_id` generated by our server — it cannot be reused or abused.

The signature uses HMAC-SHA1 over the sorted parameter string, computed with
`CLOUDINARY_API_SECRET`. The secret never leaves the server.

**WHY sort parameters alphabetically before signing?**  
Cloudinary's signature algorithm requires parameters in strict alphabetical order.
If `public_id` comes before `folder` in one request and after in another, the
signatures would differ even for identical parameters. Alphabetical sort makes
the signature deterministic.

### `uploadBuffer(buffer, options)`

Uploads a `Buffer` to Cloudinary via a stream. Used to upload the Sharp-processed
image back to Cloudinary after validation and processing.

**WHY use a stream instead of a temporary file?**  
Writing to disk (`/tmp/processed.webp`) would require cleanup logic and could
fail on Vercel's read-only filesystem. Node.js streams operate entirely in memory
and are the correct pattern for serverless environments.

### `deleteImageAsset(publicId)` / `deleteVideoAsset(publicId)`

Two separate functions instead of one with a `resourceType` parameter.

**WHY separate functions?**  
Calling the wrong resource type silently fails in Cloudinary — deleting a video
with `resource_type: 'image'` returns success but does nothing. Separate named
functions make the intent explicit and prevent this silent failure.

### `getVideoMetadata(publicId)`

Fetches video duration, dimensions, and codec from the Cloudinary API.

**WHY call Cloudinary API instead of running ffprobe locally?**  
Running ffprobe on Vercel Lambda requires bundling a binary, which adds ~50 MB
to the deployment package and is unreliable across runtime updates. Cloudinary
already processes every uploaded video and exposes its metadata via API. We reuse
their processing instead of duplicating it.

---

## Image Processing Pipeline

**File:** `src/features/media/image-processor.ts`

### `processImage(inputBuffer)`

inputBuffer
→ .rotate() strips EXIF, physically rotates pixels to match EXIF orientation
→ .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
→ .webp({ quality: 82 })
→ returns { buffer, width, height, sizeBytes }

text

**WHY `.rotate()` for EXIF stripping?**  
Sharp's `.rotate()` with no argument reads the EXIF `Orientation` tag, rotates
the actual pixels to match, and then strips all EXIF metadata from the output.
This is the idiomatic Sharp approach — it solves two problems (wrong orientation
in browsers + EXIF privacy) in one operation.

**WHY `fit: 'inside'` for resizing?**  
`inside` maintains the aspect ratio and ensures the image fits within the 1920×1920
box without cropping. A 4000×3000 photo becomes 1920×1440, not 1920×1920 (which
would crop it). The original composition is preserved.

**WHY `withoutEnlargement: true`?**  
A 400×300 thumbnail uploaded by a user should not be stretched to 1920×1440.
Enlarging a small image just adds blur and wastes bandwidth.

**WHY WebP at quality 82?**  
WebP provides ~30% smaller file sizes than JPEG at equivalent visual quality.
Quality 82 is the industry-standard sweet spot — above it, file size grows
significantly with minimal visible improvement. Below it, compression artifacts
become noticeable on photos with fine detail.

### `generateThumbnail(inputBuffer)`

inputBuffer
→ .rotate()
→ .resize(400, 300, { fit: 'cover', position: sharp.strategy.entropy })
→ .webp({ quality: 70 })
→ returns buffer

text

**WHY `fit: 'cover'` with `entropy` strategy?**  
`cover` crops the image to exactly 400×300. Without a positioning strategy, Sharp
crops from the center — a photo of a restaurant sign with the sign at the bottom
would be cropped to show only the ceiling. `entropy` finds the region of the image
with the most visual information (highest Shannon entropy) and centers the crop
there. This produces better thumbnails for varied subject matter.

**WHY lower quality (70) for thumbnails vs full images (82)?**  
Thumbnails are displayed at 400×300 in a grid — at that size, quality 70 is
visually indistinguishable from quality 82. The smaller file means faster page
loads for gallery grids where 10+ thumbnails load simultaneously.

---

## Magic Bytes Validation

**File:** `src/features/media/validators.ts`

### The Core Security Problem

A user can rename `malware.exe` to `photo.jpg`. The file extension check passes.
The browser's `File.type` property (set by the operating system) also reports
`image/jpeg` — it does not read the file contents. Both client-side checks fail.

Magic bytes are the **first few bytes of the actual binary content**. They are
part of the file format specification — a JPEG file _must_ start with `FF D8 FF`
or it will not be parsed as a JPEG by any standards-compliant software. An
attacker cannot fake magic bytes without making the file unreadable as the format
they're claiming it is.

### Magic Bytes Implemented

| Format | Magic Bytes                                            | Notes                                    |
| ------ | ------------------------------------------------------ | ---------------------------------------- |
| JPEG   | `FF D8 FF`                                             | First 3 bytes                            |
| PNG    | `89 50 4E 47`                                          | "‰PNG" in ASCII                          |
| WebP   | `52 49 46 46` (bytes 0-3) + `57 45 42 50` (bytes 8-11) | "RIFF....WEBP"                           |
| MP4    | `66 74 79 70` at offset 4                              | "ftyp" box — bytes 0-3 are variable size |

**WHY check WebP at byte offset 8?**  
WebP files use the RIFF container format. Bytes 0-3 are always `RIFF`. Bytes 4-7
are the file size (variable). Bytes 8-11 are always `WEBP`. Checking only `RIFF`
at bytes 0-3 would also match WAV audio files. The full check prevents false
positives.

**WHY check MP4 at offset 4, not offset 0?**  
The first 4 bytes of an MP4 file are the box size — a 32-bit integer that varies
per file. The `ftyp` identifier at bytes 4-7 is what identifies it as MP4/MOV.
Checking offset 0 would always fail.

### WHERE validation runs

The magic bytes check runs **server-side in `confirmUploadAction`**, after the
file has been fetched from Cloudinary. The client-side check in `MediaUploadForm`
is a **UX hint only** — it checks file extension to give the user immediate
feedback before upload. It provides zero security guarantees.

This is the correct layering: fast UX feedback client-side, real security
enforcement server-side.

---

## Server Actions

**File:** `src/features/media/actions.ts`

All six server actions follow the same security pattern:
auth() — verify session exists

zod.safeParse() — validate input types

ownership check via DB — verify the user owns the resource

business logic — the actual work

writeAuditLog() — record who did what

revalidatePath() — invalidate ISR cache

text

The ownership check is **always in the Server Action**, never in middleware.
Middleware runs on the Edge Runtime and cannot query the database. A middleware
check like "is this user logged in?" is correct. A check like "does this user
own this listing?" must happen in the Server Action where Prisma is available.

### `generatePresignedUrlAction`

Creates the signed upload parameters and a `MediaFile(status=PENDING)` DB record.

**State after this action:** `MediaFile.status = PENDING`, no Cloudinary upload yet.

### `confirmUploadAction`

The most complex action. Handles images and videos differently:

**For images:**

- Fetches raw file from Cloudinary
- Validates magic bytes (security gate)
- Runs Sharp pipeline (processImage + generateThumbnail in parallel)
- Uploads processed version back to Cloudinary
- Deletes original raw upload
- Updates DB to `APPROVED`
- Updates `businessProfile.coverImageUrl` / `logoImageUrl` if applicable

**For videos:**

- Fetches metadata from Cloudinary API
- Checks duration against `max_video_duration_seconds` PlatformSetting
- Updates DB to `PENDING` (NOT approved — videos need admin review)
- Fires notifications to all admin users

**Failure handling — the key invariant:**  
If any step fails, we **always** clean up both the Cloudinary asset AND the DB
record. We never leave an orphaned file in Cloudinary or a stale PENDING record
in the DB. This is the "failure mode" question from Mental Model 2.

```typescript
// Example: if Sharp fails
try {
  processed = await processImage(rawBuffer);
} catch (err) {
  await Promise.allSettled([
    deleteImageAsset(cloudinaryPublicId), // clean up Cloudinary
    prisma.mediaFile.delete({ where: { id: mediaFileId } }), // clean up DB
  ]);
  return { success: false, error: "فشل في معالجة الصورة" };
}
```

**WHY `Promise.allSettled` instead of `Promise.all` for cleanup?**  
If Cloudinary delete fails, we still want to delete the DB record. `Promise.all`
would stop at the first failure. `Promise.allSettled` runs both regardless of
individual outcomes — the right choice for cleanup operations.

### `deleteMediaAction`

Deletes a file from both Cloudinary and the database.

**State transitions:**

- Before: `MediaFile` exists with a Cloudinary asset
- After: `MediaFile` deleted, Cloudinary asset deleted

**WHY delete Cloudinary first?**  
If we delete the DB record first and the Cloudinary delete fails, we have an
orphaned file in Cloudinary that we've lost the reference to — we can never
clean it up. Deleting Cloudinary first means the worst case is: Cloudinary
delete fails, DB record still exists, user retries. Recoverable.

**Special case — cover/logo deletion:**  
If the deleted file was the active cover or logo (`businessProfile.coverImageId`
matches the deleted record's ID), we clear both `coverImageId` and `coverImageUrl`
on `businessProfile` in the same operation.

### `reorderMediaAction`

Updates `displayOrder` for multiple MediaFiles in a single Prisma `$transaction`.

**WHY a transaction for reordering?**  
Without a transaction, if the server crashes after updating 3 of 8 files, the
display order would be partially updated — some files at new positions, others
at old positions. A transaction guarantees atomicity: either all 8 updates
succeed or none do.

### `approveMediaAction` / `rejectMediaAction`

Admin-only actions (checked by role: `ADMIN` or `SUPERADMIN`).

**`approveMediaAction`:** Sets `status = APPROVED`, records `reviewedById` and
`reviewedAt`, notifies the listing owner, invalidates both the admin queue cache
and the public profile cache.

**`rejectMediaAction`:** Requires a rejection reason (minimum 5 characters).
Deletes the video from Cloudinary (rejected content has no reason to stay on CDN),
sets `status = REJECTED`, clears `cloudinaryPublicId` and `url` (they point to a
deleted file — keeping them would be misleading), notifies the owner with the
reason.

---

## Upload UI Components

### `MediaUploadForm.tsx`

**File:** `src/components/forms/MediaUploadForm.tsx`  
**Type:** Client Component

The main upload orchestrator. Uses `react-dropzone` for drag-and-drop and
organizes uploads into four tabs: Cover Image, Logo, Photo Gallery, Videos.

**Key design decisions:**

**State management with `tempId`:**  
When a user drops a file, we immediately add a placeholder item to the UI with
a temporary ID (`temp-${Date.now()}-${Math.random()}`). This gives instant
feedback. When `generatePresignedUrlAction` returns the real `mediaFileId`, we
replace the tempId with the real ID in state. If the action fails, we remove
the item entirely.

**WHY this pattern instead of waiting for the server action?**  
`generatePresignedUrlAction` takes ~100-300ms (network + DB write). Without
the optimistic update, the UI would freeze for that duration before showing
any progress indicator. The tempId pattern gives the user immediate visual
feedback that their drop registered.

**Per-file progress with XHR:**  
Each file gets its own `XMLHttpRequest` instance tracking its upload progress
independently. The progress is stored per-ID in the `mediaItems` state array.
This allows concurrent uploads to show individual progress bars.

**Client-side validation (UX hint, not security):**  
Before starting the upload pipeline, we check:

- File size below limit (gives instant feedback, no server round-trip needed)
- File extension in allowed list (UX hint — magic bytes check happens server-side)

These checks are **for user experience only**. They are never the security gate.

### `CoverCropper.tsx`

**File:** `src/components/forms/CoverCropper.tsx`  
**Type:** Client Component

A modal dialog using `react-image-crop` for cropping cover images to a fixed
16:9 aspect ratio.

**WHY force 16:9 for cover images?**  
The public profile page renders the cover image in a fixed-aspect `h-52`
hero section. Without enforcing 16:9 at upload time, a portrait photo would
either be distorted or have large letterbox bars. Enforcing 16:9 at crop time
means every listing looks consistent.

**WHY crop on the client before uploading?**  
Cropping on the client avoids uploading a large full-resolution image only to
crop it server-side. The user crops, the browser creates a `canvas`-derived
`Blob` of only the cropped region, and only that region is uploaded. This saves
both upload bandwidth and processing time.

**The cropping math:**  
`react-image-crop` returns crop coordinates in CSS pixels (the displayed image
size). The actual canvas drawImage call must scale these to **natural image
dimensions** (the original file size):
scaleX = image.naturalWidth / image.width
scaleY = image.naturalHeight / image.height
cropXNatural = completedCrop.x \* scaleX

text
Without this scaling, the crop would be correct for a 300px-wide preview but
wrong for the 3000px-wide original file.

### `MediaFileCard.tsx`

**File:** `src/components/forms/MediaFileCard.tsx`  
**Type:** Client Component

Displays a single uploaded file with:

- Thumbnail preview
- Upload progress overlay (during upload)
- Status badge (PENDING / APPROVED / REJECTED)
- Rejection reason (if REJECTED)
- Delete button (visible on hover)
- Video duration badge
- "Awaiting admin review" note for pending videos

---

## Admin Video Moderation Queue

**Files:**

- `src/app/[locale]/(admin)/admin/media/page.tsx` — Server Component
- `src/app/[locale]/(admin)/admin/media/VideoModerationRow.tsx` — Client Component

The page is a Server Component that fetches all `status=PENDING` videos with
`type=VIDEO` and renders a table. Each row is a Client Component for interactivity.

**WHY split Server Component (page) + Client Component (row)?**  
The table data fetching is static — it runs once when the page renders. The
per-row actions (approve, reject) require client-side state (the reject reason
textarea, the confirmation dialog, the "processing" disabled state). Putting
the entire page in a Client Component would make it opt out of React Server
Components for data fetching, losing the streaming SSR benefits. The split gives
us the best of both.

**Row design:**

- Thumbnail with inline video preview on click (plays in a Dialog without navigating away)
- Duration display in `mm:ss` format using `tabular-nums` class (digits align correctly)
- Approve button: green, sets PENDING → APPROVED, notifies owner
- Reject button: opens Dialog with a `<Textarea>` for the reason (minimum 5 chars enforced both client and server), sets PENDING → REJECTED, deletes Cloudinary asset, notifies owner

**WHY require a rejection reason?**  
A business owner who receives "your video was rejected" with no explanation will
submit the same video again. A clear reason ("video contains phone number overlay
that violates guidelines") gives the owner actionable information and reduces
re-submission of identical content.

**After approve/reject, the row disappears:**

```typescript
const [isHandled, setIsHandled] = useState(false);
if (isHandled) return null;
```

This gives instant feedback without a full page reload. The Server Component's
ISR cache is revalidated via `revalidatePath('/ar/admin/media')` inside the
action — the next hard refresh will show the updated queue.

---

## Public Profile Page Updates

**File:** `src/app/[locale]/(public)/[citySlug]/[categorySlug]/[businessSlug]/page.tsx`

The public profile page was fully rebuilt to display Phase 5 media correctly
and to match the design system.

### Media Type Filtering Fix

The old code used `m.type === "IMAGE"` and `m.type === "VIDEO"`, which were
wrong for the Phase 5 `MediaType` enum (`COVER`, `LOGO`, `PHOTO`, `VIDEO`).

The new code:

```typescript
const photoMedia = listing.mediaFiles.filter((m) => m.type === "PHOTO");
const videoMedia = listing.mediaFiles.filter((m) => m.type === "VIDEO");
// Cover and logo URLs come from denormalized BusinessProfile fields:
const coverImageUrl = listing.coverImageUrl;
const logoImageUrl = listing.logoImageUrl;
```

The query filters to `status: APPROVED` only — PENDING and REJECTED media is
never shown to public visitors.

### Layout: Two-Column RTL Grid

┌─────────────────────────────────────────┐
│ COVER HERO (h-52) │
├─────────────────────────────┬───────────┤
│ RIGHT: Main Content │ LEFT: │
│ - Business name card │ - Contact │
│ - About section │ - Address │
│ - Photo gallery │ - Hours │
│ - Videos │ │
│ - Social links │ │
└─────────────────────────────┴───────────┘

text

**WHY two columns instead of the previous single column?**  
The single-column layout buried contact information below the fold — a user
on mobile had to scroll past the description and photos before seeing the phone
number. Contact information is the primary action of a business directory. It
belongs in the sidebar, always visible without scrolling on desktop.

**WHY the RIGHT column is first in DOM for RTL?**  
CSS Grid with `direction: rtl` places the first DOM child on the visual right
side. The main content (business name, about, media) is first in DOM → visual
right. The sidebar (contact, address, hours) is second in DOM → visual left.
This is the correct reading order for screen readers in RTL documents too.

### `WorkingHoursCard.tsx` — Client Component for Day Highlighting

**WHY extract working hours into a Client Component?**  
The page uses ISR with a 1-hour cache. If we highlight "today" on the server,
a user visiting at 11:59 PM Tuesday might receive a cached response that
highlights Wednesday (the server rendered it 45 minutes ago). The client
always knows the real local time. The Client Component reads `new Date().getDay()`
in the browser — zero cost, always correct.

The day detection maps JavaScript's `getDay()` (0=Sunday, 1=Monday ... 6=Saturday)
to the Prisma `DayOfWeek` enum values used in the database.

**WHY sort working hours in the component, not via `orderBy` in the query?**  
`orderBy: { dayOfWeek: 'asc' }` sorts alphabetically: FRIDAY, MONDAY, SATURDAY,
SUNDAY, THURSDAY, TUESDAY, WEDNESDAY. This is not the correct Arabic week order.
Sorting by a `DAY_ORDER` constant in the component gives us the correct sequence:
SATURDAY → SUNDAY → MONDAY → TUESDAY → WEDNESDAY → THURSDAY → FRIDAY.

### Cover Hero Fallback

When a listing has no cover image, we show a gradient with a decorative large
character (the category icon from `category.icon`, or a default `<Utensils />`
icon for food categories).

**WHY a gradient fallback instead of a placeholder image?**  
Placeholder images from stock photo services are generic and often feel
disconnected from the actual business. A brand-colored gradient with the
category icon is faster to load (zero network request), always on-brand, and
visually consistent across all listings that haven't uploaded a cover yet.

---

## Notification Stub for Phase 9

**File:** `src/features/notifications/sender.ts`

Phase 5 needs to notify admins about pending videos and notify owners about
approval/rejection results. Phase 9 has not been built yet (full email system
via Resend).

**Solution:** Create a stub that writes an in-app `Notification` DB record now.
Phase 9 will add the email dispatch layer on top of the same function without
changing its signature.

```typescript
// Phase 5 sends:  DB record only
// Phase 9 adds:   DB record + Resend email
// Signature stays identical — zero breaking changes
export async function sendNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, unknown>,
): Promise<void>;
```

**WHY fire-and-forget (not awaited)?**  
A notification failure must never cause the main action to fail. If the DB write
for a notification fails, the video was still approved — that is the important
outcome. The owner might not receive the notification, but the video is approved.
Reversing this priority (blocking approval on notification success) would be wrong.

The pattern:

```typescript
// In every Server Action that sends a notification:
sendNotification(userId, type, data); // ← no await
// Not: await sendNotification(...)   // ← this would block the response
```

---

## i18n Messages

Added `media` namespace to both `ar.json` and `en.json`:

```json
{
  "media": {
    "cover": "صورة الغلاف",
    "logo": "الشعار",
    "photos": "معرض الصور",
    "videos": "الفيديوهات",
    "status": {
      "pending": "قيد المراجعة",
      "approved": "مقبول",
      "rejected": "مرفوض"
    },
    "errors": {
      "invalidType": "نوع الملف غير مدعوم",
      "tooLarge": "حجم الملف يتجاوز الحد المسموح",
      "uploadFailed": "فشل رفع الملف",
      "magicBytesFailed": "نوع الملف الفعلي لا يتطابق مع الامتداد — رُفض لأسباب أمنية"
    }
  }
}
```

---

## Files Created / Modified

prisma/
schema.prisma ← Updated: MediaFile, BusinessProfile, enums
migrations/XXXXXX_phase5_media_fields/ ← New migration

src/
features/
media/
cloudinary.ts ← New: SDK wrapper (4 functions)
image-processor.ts ← New: Sharp pipeline (2 functions)
validators.ts ← New: Magic bytes validation
schemas.ts ← New: Zod input schemas
queries.ts ← New: DB read helpers (5 functions)
actions.ts ← New: 6 server actions
notifications/
sender.ts ← New: Phase 9 stub
business/
queries.ts ← Updated: getListingBySlug includes Phase 5 fields

components/
forms/
MediaUploadForm.tsx ← New: Upload orchestrator
MediaFileCard.tsx ← New: Single file card
CoverCropper.tsx ← New: react-image-crop wrapper
business/
WorkingHoursCard.tsx ← New: Client component, day highlight
ShareButton.tsx ← New: Client component, Web Share API

app/[locale]/
(dashboard)/dashboard/listings/[id]/media/
page.tsx ← New: Owner upload page (step 5)
(admin)/admin/media/
page.tsx ← New: Video moderation queue
VideoModerationRow.tsx ← New: Per-row client component
(public)/[citySlug]/[categorySlug]/[businessSlug]/
page.tsx ← Updated: Two-column layout, Phase 5 media

i18n/messages/
ar.json ← Updated: media namespace
en.json ← Updated: media namespace

text

---

## Done Criteria Verification

| Criterion                                        | How It Is Satisfied                                                                                                                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Upload a JPEG → appears as WebP with no EXIF     | Sharp `.rotate()` strips EXIF + `.webp({ quality: 82 })` converts format. Verified by checking the stored file in Cloudinary — no EXIF tags present.                                                                                       |
| Upload a renamed `.exe` with `.jpg` extension    | `validateImageFile()` checks magic bytes in `confirmUploadAction`. An EXE starts with `4D 5A` ("MZ"), not `FF D8 FF` (JPEG). The check fails, the Cloudinary asset is deleted, the DB record is deleted, a clear Arabic error is returned. |
| Upload a video → appears as "pending review"     | `confirmUploadAction` sets `status = PENDING` for videos. The `MediaFileCard` shows the yellow "قيد المراجعة" badge with a note that admin approval is required.                                                                           |
| Admin approves video → appears on public profile | `approveMediaAction` sets `status = APPROVED` and calls `revalidatePath()` for the public profile URL. The next visit to the profile page triggers ISR rebuild — the approved video appears.                                               |
| Delete a photo → gone from Cloudinary AND DB     | `deleteMediaAction` calls `deleteImageAsset(publicId)` first, then `prisma.mediaFile.delete()`. Both are verified in order. The deletion of `businessProfile.coverImageUrl` is also handled if the deleted photo was the active cover.     |

---

## Key Decisions Log

| Decision                                                    | Alternatives Considered                        | Why We Chose This                                                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Direct browser-to-Cloudinary upload                         | Route file through Next.js server              | Vercel 4.5 MB body limit. Direct upload scales to 500 MB videos.                                                                        |
| Sharp for image processing                                  | Cloudinary URL transformations, jimp           | EXIF must be stripped from stored file, not just hidden at delivery. Sharp is 10-50× faster than jimp.                                  |
| Magic bytes validation server-side                          | Extension check, MIME type from browser        | Extension and MIME type are both client-controlled. Magic bytes require reading actual binary content.                                  |
| Denormalize coverImageUrl / logoImageUrl on BusinessProfile | JOIN to MediaFile on every profile page render | Profile page is the most-read page. Eliminates 2 DB queries per render.                                                                 |
| WorkingHoursCard as Client Component                        | Highlight today on server                      | ISR cache means server-rendered "today" can be stale by up to 1 hour. Client always has correct local time.                             |
| Notification stub now, email in Phase 9                     | Skip notifications until Phase 9               | Phase 5 actions need to call sendNotification(). Stub keeps the call site identical — Phase 9 adds email without changing Phase 5 code. |
| Fire-and-forget notifications (not awaited)                 | Await notification before returning success    | Notification failure must never fail the main action. Approval/deletion is the important event.                                         |
| Float for durationSeconds                                   | Int                                            | Videos can be 90.5 seconds. Storing 90 loses precision needed for accurate mm:ss display.                                               |
