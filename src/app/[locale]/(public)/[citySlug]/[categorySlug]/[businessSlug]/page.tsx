import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getListingBySlug } from "@/features/business/queries";
import { ListingViewTracker } from "@/features/business/listing-view-tracker";
import Image from "next/image";

// ISR: rebuild this page at most once per hour
export const revalidate = 3600;

type Props = {
  params: Promise<{
    locale: string;
    citySlug: string;
    categorySlug: string;
    businessSlug: string;
  }>;
};

// Pre-generate top 100 most-viewed listings × 2 locales at build time
export async function generateStaticParams() {
  const listings = await prisma.businessProfile.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: {
      slug: true,
      city: { select: { slug: true } },
      category: { select: { slug: true } },
    },
    orderBy: { viewCount: "desc" },
    take: 100,
  });

  return listings.flatMap((l) => [
    {
      locale: "ar",
      citySlug: l.city.slug,
      categorySlug: l.category.slug,
      businessSlug: l.slug,
    },
    {
      locale: "en",
      citySlug: l.city.slug,
      categorySlug: l.category.slug,
      businessSlug: l.slug,
    },
  ]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { businessSlug } = await params;
  const listing = await getListingBySlug(businessSlug);
  if (!listing) return {};

  const coverImage = listing.mediaFiles.find(
    (m) => m.type === "IMAGE" && m.id === listing.logoImageUrl,
  );

  return {
    title: `${listing.nameAr} | ${listing.category.nameAr} | النبك`,
    description: listing.descriptionAr ?? listing.addressAr ?? listing.nameAr,
    openGraph: {
      title: `${listing.nameAr} | ${listing.category.nameAr} | النبك`,
      description: listing.descriptionAr ?? "",
      ...(coverImage?.url ? { images: [coverImage.url] } : {}),
    },
  };
}

const DAY_LABELS: Record<string, string> = {
  SATURDAY: "السبت",
  SUNDAY: "الأحد",
  MONDAY: "الاثنين",
  TUESDAY: "الثلاثاء",
  WEDNESDAY: "الأربعاء",
  THURSDAY: "الخميس",
  FRIDAY: "الجمعة",
};

export default async function BusinessProfilePage({ params }: Props) {
  const { businessSlug } = await params;
  const listing = await getListingBySlug(businessSlug);

  if (!listing) notFound();

  const primaryPhone =
    listing.phoneNumbers.find((p) => p.isPrimary) ?? listing.phoneNumbers[0];

  // Schema.org LocalBusiness JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: listing.nameAr,
    ...(listing.nameEn ? { alternateName: listing.nameEn } : {}),
    ...(listing.descriptionAr ? { description: listing.descriptionAr } : {}),
    ...(primaryPhone ? { telephone: primaryPhone.number } : {}),
    ...(listing.addressAr
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: listing.addressAr,
          },
        }
      : {}),
    ...(listing.latitude && listing.longitude
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: listing.latitude,
            longitude: listing.longitude,
          },
        }
      : {}),
    openingHoursSpecification: listing.workingHours
      .filter((h) => !h.isClosed)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${h.dayOfWeek}`,
        opens: h.openTime,
        closes: h.closeTime,
      })),
  };

  const photos = listing.mediaFiles.filter((m) => m.type === "IMAGE");
  const videos = listing.mediaFiles.filter((m) => m.type === "VIDEO");

  return (
    <>
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Fire-and-forget view counter — never blocks render */}
      <ListingViewTracker listingId={listing.id} />

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8" dir="rtl">
        {/* ── Header ── */}
        <div className="space-y-2">
          <div className="flex items-start gap-4">
            {listing.logoImageUrl && (
              <Image
                src={
                  photos.find((m) => m.id === listing.logoImageUrl)?.url ?? ""
                }
                alt={`شعار ${listing.nameAr}`}
                width={64}
                height={64}
                loading="eager"
                className="h-16 w-16 rounded-xl object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold">{listing.nameAr}</h1>
              {listing.nameEn && (
                <p className="text-muted-foreground">{listing.nameEn}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-muted px-3 py-0.5">
                  {listing.category.nameAr}
                </span>
                <span className="rounded-full bg-muted px-3 py-0.5">
                  {listing.city.nameAr}
                </span>
                {listing.isVerified && (
                  <span className="rounded-full bg-blue-100 px-3 py-0.5 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    موثّق ✓
                  </span>
                )}
              </div>
            </div>
          </div>

          {listing.descriptionAr && (
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {listing.descriptionAr}
            </p>
          )}
        </div>

        {/* ── Contact ── */}
        {listing.phoneNumbers.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">أرقام التواصل</h2>
            <ul className="space-y-2">
              {listing.phoneNumbers.map((phone) => (
                <li key={phone.id} className="flex items-center gap-3">
                  <a
                    href={`tel:${phone.number}`}
                    dir="ltr"
                    className="font-mono text-primary hover:underline"
                  >
                    {phone.number}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {phone.label === "MOBILE" && "موبايل"}
                    {phone.label === "LANDLINE" && "أرضي"}
                    {phone.label === "WHATSAPP" && "واتساب"}
                    {phone.label === "OTHER" && "أخرى"}
                  </span>
                  {phone.isPrimary && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      أساسي
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Address ── */}
        {listing.addressAr && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">العنوان</h2>
            <p className="text-muted-foreground">{listing.addressAr}</p>
          </section>
        )}

        {/* ── Static Map ── */}
        {listing.latitude && listing.longitude && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">الموقع على الخريطة</h2>
            <a
              href={`https://www.google.com/maps?q=${listing.latitude},${listing.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src={`https://maps.googleapis.com/maps/api/staticmap?center=${listing.latitude},${listing.longitude}&zoom=15&size=600x280&markers=color:red%7C${listing.latitude},${listing.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""}`}
                alt={`موقع ${listing.nameAr} على الخريطة`}
                width={600}
                height={280}
                loading="lazy"
                className="w-full rounded-xl"
              />
            </a>
          </section>
        )}

        {/* ── Working Hours ── */}
        {listing.workingHours.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">ساعات العمل</h2>
            <div className="divide-y rounded-xl border">
              {listing.workingHours.map((day) => (
                <div
                  key={String(day.dayOfWeek)}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="font-medium">
                    {DAY_LABELS[String(day.dayOfWeek)] ?? String(day.dayOfWeek)}
                  </span>
                  <span className="text-muted-foreground">
                    {day.isClosed
                      ? "مغلق"
                      : `${day.openTime ?? ""} – ${day.closeTime ?? ""}`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Photo Gallery ── */}
        {photos.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">الصور</h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {photos.map((media) => (
                <Image
                  key={media.id}
                  src={media.url}
                  alt={listing.nameAr}
                  width={400}
                  height={300}
                  loading="lazy"
                  className="aspect-video w-full rounded-lg object-cover"
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Videos ── */}
        {videos.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">الفيديوهات</h2>
            <div className="space-y-3">
              {videos.map((video) => (
                <video
                  key={video.id}
                  src={video.url}
                  controls
                  width={600}
                  className="w-full rounded-xl"
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Social Links ── */}
        {listing.socialLinks.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">روابط التواصل الاجتماعي</h2>
            <ul className="flex flex-wrap gap-3">
              {listing.socialLinks.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition hover:bg-muted"
                  >
                    {link.platform === "FACEBOOK" && "Facebook"}
                    {link.platform === "INSTAGRAM" && "Instagram"}
                    {link.platform === "WHATSAPP" && "WhatsApp"}
                    {link.platform === "TELEGRAM" && "Telegram"}
                    {link.platform === "YOUTUBE" && "YouTube"}
                    {link.platform === "TIKTOK" && "TikTok"}
                    {link.platform === "WEBSITE" && "الموقع الإلكتروني"}
                    {link.platform === "OTHER" && "رابط آخر"}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Flag Report ── */}
        <section className="border-t pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            هل هذه المعلومات غير صحيحة؟{" "}
            <button
              type="button"
              className="text-destructive hover:underline"
              //   onClick={() => alert("خاصية الإبلاغ ستكون متاحة قريباً")}
            >
              أبلغ عن خطأ
            </button>
          </p>
        </section>
      </main>
    </>
  );
}
