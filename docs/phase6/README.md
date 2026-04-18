# Phase 6: Public Directory Browse, Search & Filter

## Overview

Phase 6 implements the public-facing directory system that allows users to:
1. **Browse** businesses by city and category
2. **Search** for listings with live search results
3. **View featured** businesses on the homepage

---

## Theory & Planning

### Goal
Create a public directory system where users can discover businesses without authentication.

### Key Requirements
- Homepage showing featured listings
- Category browse pages (`/[locale]/[city]/[category]`)
- Live search with dropdown results
- Filter by subcategory
- SEO-friendly static generation

### Architecture
```
[locale]/                    → Homepage (featured + categories)
[locale]/[city]/[category] → Category browse page (listings grid)
```

---

## Implementation

### Files Created/Modified

#### 1. Category Browse Page
**File:** `src/app/[locale]/(public)/[citySlug]/[categorySlug]/page.tsx`

- Displays all businesses in a category
- Shows subcategory filter pills
- Grid of listing cards
- Static generation with `generateStaticParams`

```tsx
// Key features
export const dynamicParams = true;
export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.flatMap((category) => [
    { locale: "ar", citySlug: "al-nabik", categorySlug: category.slug },
    { locale: "en", citySlug: "al-nabik", categorySlug: category.slug },
  ]);
}
```

#### 2. Search Bar Component
**File:** `src/components/shared/search-bar.tsx`

- Client-side live search
- Debounced input (2+ characters)
- Results dropdown with click-to-navigate

```tsx
"use client";
export function SearchBar() {
  const locale = useLocale(); // Dynamic locale
  
  // Results Link: /${locale}/al-nabik/${category.slug}/${slug}
}
```

#### 3. Homepage Updates
**File:** `src/app/[locale]/page.tsx`

- Added featured listings section
- Show 6 top-rated businesses
- Links to category pages

#### 4. Database Queries
**File:** `src/features/business/queries.ts`

- `getPublicListings()` - Get listings by city/category
- `searchListings()` - Full-text search
- `getFeaturedListings()` - Top viewed active listings

#### 5. Server Actions
**File:** `src/features/business/actions.ts`

- `searchListingsAction` - Server action for live search

---

## Issues & Solutions

### Issue 1: Double Locale Prefix in Links (MISUNDERSTOOD)
**Initial Misunderstanding:** Thought we needed to add `/${locale}` manually to links

**Correct Solution:** next-intl Link automatically adds the locale prefix. DO NOT add `/${locale}` manually!

**Correct Code:**
```tsx
href={`al-nabik/${category.slug}`}  // next-intl adds /ar or /en automatically
```

**What NOT to do:**
```tsx
href={`/${locale}/al-nabik/${category.slug}`}  // WRONG! Creates /ar/ar/...
```

**Files Fixed:**
- `src/app/[locale]/page.tsx` - Category and featured listing links
- `src/app/[locale]/(public)/[citySlug]/[categorySlug]/page.tsx` - All internal links
- `src/components/shared/search-bar.tsx` - Result links

### Issue 2: Vercel 404 on Deployment
**Symptom:** Works locally but returns 404 on Vercel

**Root Cause:** Next.js static generation not properly configured

**Solution:**
1. Added `generateStaticParams` to pages
2. Set `dynamicParams = true` (allows ISR for new content)
3. Clear Vercel build cache on redeploy

**Homepage:**
```tsx
export async function generateStaticParams() {
  return [{ locale: "ar" }, { locale: "en" }];
}
```

### Issue 3: Type Error with Prisma Adapter
**Symptom:** `Type 'Adapter' is not assignable...`

**Solution:** Add `@ts-expect-error` directive (later removed by user)

---

## API Reference

### Queries

```typescript
// Get listings for a category
const listings = await getPublicListings({
  citySlug: "al-nabik",
  categorySlug: "pharmacies",
  limit: 50
});

// Full-text search
const results = await searchListings({ query: "صيدلية" });

// Featured (top viewed)
const featured = await getFeaturedListings({ limit: 6 });
```

### Translations Added
- `search.placeholder` - "ابحث عن نشتجات..."
- `search.noResults` - "لا توجد نتائج"
- `directory.categories` - "التصنيفات"
- `directory.featured` - "المميز"
- `listings.noListings` - "لا توجد نشتجات"
- `directory.allSubcategories` - "الكل"

---

## Verification

After deployment, verify:

1. **Homepage loads** - http://localhost:3000/ar
2. **Category page** - http://localhost:3000/ar/al-nabik/pharmacies
3. **Search works** - Type in search box, see dropdown
4. **No double locale** - Links should be `/ar/al-nabik/...` not `/ar/ar/...`

---

## Commit History

| Commit | Description |
|--------|-------------|
| c2319fa | feat(phase6): complete public directory browse, search, and filter |
| 48e142e | fix(links): add locale prefix to all navigation links |
| c59ce1f | fix(build): add generateStaticParams for static export |
| da4551d | fix(lib/auth): solve bug created from ai |

---

## Dependencies

No new dependencies added - uses existing:
- `next-intl` for i18n
- Prisma for database queries
- Upstash Redis for caching

---

## Security

- All database queries use read-only operations
- No sensitive data exposed
- Search sanitized via Prisma
- Client components use Server Actions for data fetching