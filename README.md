# Phase 4: Business Profile & Owner Dashboard

**الحالة:** ✅ مكتمل  
**المدة الفعلية:** ~7 أيام  
**التبعيات:** Phase 0 → Phase 1 → Phase 2 → Phase 3

---

## ما الذي بنيناه في هذه المرحلة؟

Phase 4 هي القلب النابض للتطبيق بأكمله. قبلها كان لدينا:

- بنية تحتية (Phase 0)
- نظام تسجيل دخول (Phase 1)
- قاعدة بيانات ونماذج (Phase 2)
- نظام التصنيفات (Phase 3)

بعدها أصبح لدينا الشيء الحقيقي: **صاحب عمل يستطيع إنشاء قائمة، تعديلها، نشرها، وظهورها للعموم على رابط عام.**

---

## المفاهيم النظرية التي طبّقناها

### 1. نموذج الدوائر الثلاث (Three Concentric Circles)

```
┌─────────────────────────────────────────┐
│  OUTER — Client (Browser)               │
│  NewListingForm, DashboardPage          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  MIDDLE — Security Boundary       │  │
│  │  Server Actions + API Routes      │  │
│  │  ← كل الـ Authorization هنا      │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  INNER — Data               │  │  │
│  │  │  PostgreSQL + Redis         │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**القاعدة الذهبية:** Client Component لا يكلّم قاعدة البيانات أبدًا.  
كل شيء يمر عبر Server Actions → هذا هو المكان الوحيد الذي تحدث فيه صلاحيات الملكية.

---

### 2. آلة الحالات (State Machine)

الـ `BusinessProfile` لديه حالات محددة وانتقالات مسموح بها فقط:

```
DRAFT ──(owner submits)──→ ACTIVE
                              │
                    (admin)   ↓         (admin)
                         SUSPENDED ────→ ACTIVE

❌ ACTIVE → DRAFT: غير مسموح (لمنع حذف القوائم المنشورة عن طريق الخطأ)
```

هذا يعني: صاحب العمل لا يستطيع "سحب" قائمته بعد النشر. المسؤول فقط يستطيع تعليقها.

**لماذا State Machine وليس boolean بسيط؟**  
لأن `boolean isPublished` يصعب التوسع فيه. ماذا لو أضفنا حالة `PENDING_REVIEW` لاحقًا؟ مع enum وState Machine هذا تغيير سطر واحد.

---

### 3. توليد الـ Slug من العربية

المشكلة: الروابط في الإنترنت لا تدعم الأحرف العربية بشكل جيد.  
الحل: تحويل الاسم العربي إلى حروف لاتينية.

```
"صيدلية رفاء طلا"
    ↓ transliterate
"saydaliyat rafa tla"
    ↓ lowercase + replace spaces
"saydaliyat-rafa-tla"
    ↓ check DB collision
"saydaliyat-rafa-tla-2"  ← إذا كان موجودًا مسبقًا
```

---

### 4. Server Component يمرر Data لـ Client Component

هذا أهم مفهوم في Next.js App Router:

```
page.tsx (Server Component)
    │
    ├── يتصل بـ Prisma مباشرة
    ├── يجلب categories + cities
    │
    └── <NewListingForm categories={...} cities={...} />
              │
              └── 'use client'
                  ├── يعرض الـ form للمستخدم
                  ├── يستدعي Server Action
                  └── يعرض أخطاء أو يعمل redirect
```

الـ Client Component لا يعرف كيف جُلبت البيانات — هو فقط يستهلكها.

---

### 5. نمط ActionResult بدل throw

**المشكلة:** عند `throw new Error('...')` داخل Server Action، الصفحة تنكسر بالكامل.

**الحل:** نرجع object يصف النتيجة:

```typescript
// ❌ قبل
if (rateLimited)
  throw new Error("You can create only one new listing every 24 hours");

// ✅ بعد
if (rateLimited)
  return actionError("يمكنك إنشاء قائمة واحدة فقط كل 24 ساعة", "RATE_LIMITED");
```

**القاعدة:**

- `throw` → للأخطاء غير المتوقعة (DB crash، network error)
- `return actionError()` → للأخطاء المتوقعة (rate limit، validation، owner limit)

---

### 6. ISR — Incremental Static Regeneration

الصفحات العامة للأعمال هي static pages تُعاد بناؤها كل ساعة:

```
المستخدم يفتح الرابط
        │
        ↓
هل الصفحة cached؟
   │              │
  نعم            لا
   │              │
تُعرض فورًا    تُبنى وتُحفظ
   │              │
   └──────────────┘
         ↓
    revalidatePath() عند تحديث البيانات
    → Next.js يبني النسخة الجديدة في الخلفية
```

**لماذا ISR وليس SSR؟**  
SSR يبني كل صفحة عند كل request → بطيء ومكلف.  
ISR يبني مرة وتخدم الملايين → سريع وبدون تكلفة.

---

## الملفات التي أنشأناها

```
src/
  lib/
    action-response.ts          ← ActionResult<T> pattern

  features/
    business/
      constants.ts              ← WEEK_DAYS, rate limit constants
      types.ts                  ← TypeScript types
      schemas.ts                ← Zod validation schemas
      utils.ts                  ← canTransitionTo, generateSlug, buildSearchableText
      queries.ts                ← getListingBySlug, getListingsByOwner, getPublicListings
      actions.ts                ← createListing, updateListing, submitListing, softDelete

  components/
    business/
      listing-view-tracker.tsx  ← fire-and-forget view counter
      forms/
        new-listing-form.tsx    ← Client Component for creating listing

  app/
    [locale]/
      (dashboard)/
        dashboard/
          listings/
            new/
              page.tsx          ← Server Component يجلب categories+cities
            [id]/
              page.tsx          ← Step 1: Basic info
              contact/page.tsx  ← Step 2: Phones + Address
              hours/page.tsx    ← Step 3: Working hours
              social/page.tsx   ← Step 4: Social links
              media/page.tsx    ← Step 5: Photos (Phase 5)

      (public)/
        [citySlug]/
          [categorySlug]/
            [businessSlug]/
              page.tsx          ← Public ISR profile page

    api/v1/
      businesses/
        [id]/
          view/route.ts         ← View counter API
```

---

## تفاصيل كل Server Action

### `createListingAction`

```
الدخل: { nameAr, categoryId, cityId, ... }

الخطوات:
1. requireVerifiedOwnerSession()     ← المستخدم مسجل دخول ومتحقق البريد؟
2. currentCount >= maxListings?      ← وصل للحد الأقصى من القوائم؟
3. redis.get(`listing_create:${id}`) ← أنشأ قائمة خلال 24 ساعة؟
4. CreateListingSchema.parse(rawData)← البيانات صحيحة؟
5. validateCategoryAndSubcategory()  ← التصنيف موجود؟ الفئة الفرعية تنتمي له؟
6. prisma.city.findUnique()          ← المدينة موجودة؟
7. prisma.$transaction(async tx => { ← الكل أو لا شيء
     tx.businessProfile.create()     ← أنشئ المسودة
     tx.workingHours.createMany()    ← 7 أيام مغلقة افتراضيًا
   })
8. redis.setex(rateLimitKey, ...)    ← قيّد الـ rate limit
9. writeAuditLog(...)                ← سجّل في audit log
10. return actionSuccess({ id, slug })
```

**لماذا Transaction؟**  
إذا نجح إنشاء الـ BusinessProfile لكن فشل إنشاء WorkingHours → سيكون لدينا listing بدون أيام عمل.  
الـ Transaction يضمن: إما الكل ينجح أو الكل يُلغى.

---

### `updateListingAction`

يعمل حسب الـ `step`:

| Step      | ما يُحدَّث                                                         |
| --------- | ------------------------------------------------------------------ |
| `basic`   | nameAr, nameEn, description, category, city, slug (إذا تغير الاسم) |
| `contact` | address, coordinates, phones (deleteMany + createMany)             |
| `hours`   | 7 أيام (deleteMany + createMany)                                   |
| `social`  | social links (deleteMany + createMany)                             |

كل step:

1. يتحقق من الملكية أولًا: `findFirst({ where: { id, ownerId } })`
2. يبني JSON diff للـ audit log
3. يحدّث البيانات
4. يستدعي `revalidatePath()` على الرابط العام

---

### `submitListingAction`

```
التحقق → canTransitionTo(DRAFT, ACTIVE) → تحقق من الحقول المطلوبة
    ↓
status: 'ACTIVE', publishedAt: now()
    ↓
writeAuditLog + revalidatePath (profile + category pages)
```

**لماذا auto-approve وليس manual review؟**  
قرار معماري في ADR-003: Manual review يُبطئ العملية.  
بدلًا من ذلك: badge "غير موثّق" + نظام إبلاغ + أدمن يتصرف بعد الحقيقة.

---

## الصفحة العامة — كيف تعمل ISR

```typescript
export const revalidate = 3600; // تُعاد البناء كل ساعة كحد أقصى

export async function generateStaticParams() {
  // أهم 100 قائمة × 2 لغات = 200 صفحة مبنية مسبقًا عند الـ build
  return listings.flatMap((l) =>
    ["ar", "en"].map((locale) => ({ locale, ...slugs })),
  );
}
```

عند تعديل القائمة من الداشبورد:

```
updateListingAction()
    ↓
revalidatePath('/ar/al-nabik/pharmacies/saydaliyat-al-nour')
revalidatePath('/en/al-nabik/pharmacies/saydaliyat-al-nour')
    ↓
Next.js يبني النسخة الجديدة عند أول زيارة لاحقة
```

---

## عداد المشاهدات — Fire and Forget

```
المستخدم يفتح صفحة العمل
    ↓
الصفحة تُعرض فورًا (لا ننتظر شيئًا)
    ↓
useEffect يُطلق request في الخلفية (لا نهتم بالرد)
    ↓
/api/v1/businesses/:id/view
    ↓
هل شاهد هذا الـ IP هذه القائمة خلال 24 ساعة؟ (Redis)
    ├── نعم → { counted: false }
    └── لا  → viewCount += 1, سجّل في Redis
```

**لماذا fire-and-forget؟**  
لأن عداد المشاهدات لا يجب أن يُبطئ تحميل الصفحة.  
إذا فشل الـ request → لا يهم، الصفحة مرت بشكل مثالي.

---

## الأخطاء التي واجهناها وكيف حللناها

### 1. خطأ DayOfWeek enum

```
Expected DayOfWeek, provided Int.
```

**السبب:** `WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6]` أرقام صحيحة.  
**الحل:** `WEEK_DAYS: DayOfWeek[] = [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY, ...]`

**الدرس:** Prisma strict enums — لا يقبل `Int` بدل `enum`.

---

### 2. خطأ الـ Redirect مع query params زائدة

```
/ar/dashboard/listings/[id]?id=xxx   ← خاطئ
/ar/dashboard/listings/xxx           ← صحيح
```

**السبب:** استخدام `query: { id }` في الـ redirect.  
**الحل:** `router.push(\`/${locale}/dashboard/listings/${result.data.id}\`)`

---

### 3. صفحة تنكسر عند rate limit

```
throw new Error('...') → الصفحة تنكسر
```

**الحل:** `return actionError('...', 'RATE_LIMITED')` + Client يعرض banner أحمر.

---

### 4. Categories لا تظهر في الـ Form

**السبب:** الـ `page.tsx` لم يكن يجلب البيانات من DB ويمررها كـ props.  
**الحل:** Server Component يجلب + يمرر، Client Component يعرض.

---

## معمارية مهمة: لماذا ملفان بدل ملف واحد

```typescript
// src/lib/api-response.ts ← للـ API Routes
return Response.json(buildSuccess({ counted: true }));
// يُرجع HTTP Response مع status code

// src/lib/action-response.ts ← للـ Server Actions
return actionSuccess({ id: created.id, slug: created.slug });
// يُرجع plain object يقرأه Client Component مباشرة
```

الفصل بينهما مهم: API Routes تُستهلك من mobile apps وتحتاج HTTP status codes.  
Server Actions تُستهلك من Client Components مباشرة.

---

## ✅ معايير اكتمال Phase 4

- [x] صاحب عمل يُنشئ قائمة → تظهر بحالة `DRAFT` مع 7 أيام عمل
- [x] Rate limit: قائمة واحدة كل 24 ساعة لكل مستخدم
- [x] تعديل الاسم العربي → يُعيد توليد الـ slug تلقائيًا
- [x] تقديم القائمة → الحالة تتغير لـ `ACTIVE`
- [x] الرابط العام `/ar/al-nabik/{category}/{slug}` يعرض الصفحة
- [x] تعديل القائمة → `revalidatePath` → الرابط العام يتحدث خلال ثوانٍ
- [x] عداد المشاهدات: IP واحد = مشاهدة واحدة كل 24 ساعة
- [x] JSON-LD `LocalBusiness` في كل صفحة عامة
- [x] الداشبورد يعرض عدد القوائم وحالتها
- [x] الأخطاء المتوقعة تُعرض للمستخدم بدل كسر الصفحة

---

## ما يأتي في Phase 5

Phase 5 تكمل ما بدأناه هنا:

- رفع الصور والفيديو (Cloudinary)
- معالجة الصور (Sharp → WebP)
- التحقق من magic bytes للأمان
- Step 5 في الداشبورد (Media tab)
- قائمة انتظار الفيديو للأدمن

> **قبل البدء في Phase 5:** أعد قراءة هذا الملف وتأكد من اجتياز جميع معايير الاكتمال أعلاه.
