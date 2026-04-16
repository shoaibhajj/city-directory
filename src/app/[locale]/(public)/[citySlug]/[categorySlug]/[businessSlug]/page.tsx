import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";

import {
  Phone,
  MapPin,
  ExternalLink,
  Flag,
  CheckCircle2,
  Utensils,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getListingBySlug } from "@/features/business/queries";
import { ListingViewTracker } from "@/features/business/listing-view-tracker";
import { Link } from "@/i18n/navigation";
import { ShareButton } from "@/features/business/components/ShareButton";
import { WorkingHoursCard } from "@/features/business/components/WorkingHoursCard";

// ISR: rebuild at most once per hour
export const revalidate = 3600;

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{
    locale: string;
    citySlug: string;
    categorySlug: string;
    businessSlug: string;
  }>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_ORDER = [
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

// const PHONE_LABEL: Record<string, string> = {
//   MOBILE: "موبايل",
//   LANDLINE: "أرضي",
//   WHATSAPP: "واتساب",
//   OTHER: "أخرى",
// };

const SOCIAL_LABEL: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  WEBSITE: "الموقع الإلكتروني",
  OTHER: "رابط آخر",
};

// ─── generateStaticParams ─────────────────────────────────────────────────────
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
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
  } catch (error) {
    console.warn(
      "generateStaticParams: DB unreachable at build time, pages will render on first request via ISR:",
      error,
    );
    return [];
  }
}

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { businessSlug } = await params;
  const listing = await getListingBySlug(businessSlug);
  if (!listing) return {};

  // Use the denormalized coverImageUrl from BusinessProfile (Phase 5)
  const ogImage = listing.coverImageUrl ?? undefined;

  return {
    title: `${listing.nameAr} | ${listing.category.nameAr} | النبك`,
    description: listing.descriptionAr ?? listing.addressAr ?? listing.nameAr,
    openGraph: {
      title: `${listing.nameAr} | ${listing.category.nameAr} | النبك`,
      description: listing.descriptionAr ?? "",
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function BusinessProfilePage({ params }: Props) {
  const { locale, citySlug, categorySlug, businessSlug } = await params;
  const listing = await getListingBySlug(businessSlug);
  if (!listing) notFound();

  // ── Media (Phase 5 types: COVER, LOGO, PHOTO, VIDEO) ──
  // coverImageUrl / logoImageUrl are denormalized on BusinessProfile for speed.
  // mediaFiles is already filtered to APPROVED in the query.
  const coverImageUrl = listing.coverImageUrl;
  const logoImageUrl = listing.logoImageUrl;
  const photoMedia = listing.mediaFiles.filter((m) => m.type === "PHOTO");
  const videoMedia = listing.mediaFiles.filter((m) => m.type === "VIDEO");

  // ── Phones ──
  const whatsappPhone = listing.phoneNumbers.find(
    (p) => p.label === "WHATSAPP",
  );
  const otherPhones = listing.phoneNumbers.filter(
    (p) => p.label !== "WHATSAPP",
  );
  const primaryPhone =
    listing.phoneNumbers.find((p) => p.isPrimary) ?? listing.phoneNumbers[0];

  // WhatsApp deep-link — strip all non-digit chars, add Syria country code if local number
  const waNumber =
    (whatsappPhone ?? primaryPhone)?.number.replace(/\D/g, "") ?? "";
  const waLink = waNumber ? `https://wa.me/${waNumber}` : null;

  // ── Social links keyed for the contact card sidebar ──
  // const facebookLink = listing.socialLinks.find(
  //   (s) => s.platform === "FACEBOOK"
  // );

  // ── Working hours — sorted in Arabic week order regardless of DB return order ──
  const sortedHours = [...listing.workingHours].sort(
    (a, b) =>
      DAY_ORDER.indexOf(String(a.dayOfWeek)) -
      DAY_ORDER.indexOf(String(b.dayOfWeek)),
  );

  // ── Canonical URL for share ──
  const canonicalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/${citySlug}/${categorySlug}/${businessSlug}`;

  // ── JSON-LD ──
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
    ...(coverImageUrl ? { image: coverImageUrl } : {}),
    openingHoursSpecification: listing.workingHours
      .filter((h) => !h.isClosed)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${h.dayOfWeek}`,
        opens: h.openTime,
        closes: h.closeTime,
      })),
  };

  // ── Google Maps static image ──
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  const hasCoords = listing.latitude && listing.longitude;
  const staticMapUrl =
    hasCoords && mapsApiKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${listing.latitude},${listing.longitude}&zoom=15&size=600x240&markers=color:red%7C${listing.latitude},${listing.longitude}&key=${mapsApiKey}`
      : null;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Fire-and-forget view counter — never blocks render */}
      <ListingViewTracker listingId={listing.id} />

      <div className="min-h-screen bg-[var(--color-bg)]">
        {/* ══════════════════════════════════════════════════════
            COVER HERO
        ══════════════════════════════════════════════════════ */}
        <div className="relative h-52 w-full overflow-hidden">
          {coverImageUrl ? (
            <Image
              src={coverImageUrl}
              alt={`صورة غلاف ${listing.nameAr}`}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          ) : (
            /* Fallback gradient — warm sage-green to golden beige */
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(135deg, #c8d9b2 0%, #d6ce9a 50%, #e8d888 100%)",
              }}
            >
              {/* Large decorative icon — category icon or default */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-[140px] font-bold leading-none select-none"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                  aria-hidden
                >
                  {listing.category.icon ?? <Utensils className="w-32 h-32" />}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════
            TWO-COLUMN LAYOUT
            dir="rtl" → first child = visual RIGHT, second = visual LEFT
        ══════════════════════════════════════════════════════ */}
        <div className="mx-auto max-w-4xl px-4 py-5">
          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_288px]"
            dir="rtl"
          >
            {/* ── RIGHT COLUMN — Main Content ────────────────── */}
            <div className="min-w-0 space-y-4">
              {/* ── Business Name Card ── */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  {/* Name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-bold text-[var(--color-text)] leading-tight">
                        {listing.nameAr}
                      </h1>
                      {listing.isVerified && (
                        <CheckCircle2
                          className="w-5 h-5 shrink-0 text-blue-500"
                          aria-label="منشأة موثّقة"
                        />
                      )}
                    </div>

                    {listing.nameEn && (
                      <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                        {listing.nameEn}
                      </p>
                    )}

                    {/* Action row */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {/* Category badge — orange */}
                      <Link
                        href={`/${locale}/${citySlug}/${categorySlug}`}
                        className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1
                                   text-xs font-medium text-orange-800 transition-colors
                                   hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300"
                      >
                        {listing.category.nameAr}
                      </Link>

                      {/* City badge */}
                      <Link
                        href={`/${locale}/${citySlug}`}
                        className="inline-flex items-center gap-1 rounded-full border
                                   border-[var(--color-border)] px-3 py-1 text-xs
                                   text-[var(--color-text-muted)] transition-colors
                                   hover:bg-[var(--color-surface-offset)]"
                      >
                        <MapPin className="w-3 h-3" />
                        {listing.city.nameAr}
                      </Link>

                      {/* Share button (client) */}
                      <ShareButton title={listing.nameAr} url={canonicalUrl} />
                    </div>
                  </div>

                  {/* Logo thumbnail */}
                  <div className="shrink-0">
                    {logoImageUrl ? (
                      <Image
                        src={logoImageUrl}
                        alt={`شعار ${listing.nameAr}`}
                        width={80}
                        height={80}
                        className="h-20 w-20 rounded-xl object-cover
                                   border border-[var(--color-border)]"
                      />
                    ) : (
                      /* Placeholder with first letter */
                      <div
                        className="flex h-20 w-20 items-center justify-center rounded-xl
                                   bg-[var(--color-surface-offset)]
                                   border border-[var(--color-border)]"
                      >
                        <span className="text-2xl font-bold text-[var(--color-text-muted)]">
                          {listing.nameAr.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── About Card ── */}
              {listing.descriptionAr && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                    عن العمل
                    <span
                      className="text-[var(--color-text-faint)]"
                      aria-hidden
                    >
                      ⓘ
                    </span>
                  </h2>
                  <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                    {listing.descriptionAr}
                  </p>
                </div>
              )}

              {/* ── Photo Gallery ── */}
              {photoMedia.length > 0 && (
                <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">
                    معرض الصور
                    <span className="mr-1.5 text-xs font-normal text-[var(--color-text-muted)]">
                      ({photoMedia.length})
                    </span>
                  </h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {photoMedia.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative aspect-video overflow-hidden rounded-lg"
                      >
                        <Image
                          src={photo.url ?? ""}
                          alt={listing.nameAr}
                          fill
                          loading="lazy"
                          className="object-cover transition-transform duration-300 hover:scale-105"
                          sizes="(max-width: 640px) 50vw, 33vw"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Videos ── */}
              {videoMedia.length > 0 && (
                <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">
                    الفيديوهات
                  </h2>
                  <div className="space-y-3">
                    {videoMedia.map((video) => (
                      <video
                        key={video.id}
                        src={video.url ?? undefined}
                        poster={video.thumbnailUrl ?? undefined}
                        controls
                        preload="metadata"
                        className="w-full rounded-lg bg-black"
                        style={{ maxHeight: "360px" }}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Social Links ── */}
              {listing.socialLinks.length > 0 && (
                <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">
                    روابط التواصل الاجتماعي
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {listing.socialLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border
                                   border-[var(--color-border)] px-3 py-1.5 text-xs
                                   text-[var(--color-text-muted)] transition-colors
                                   hover:bg-[var(--color-surface-offset)]
                                   hover:text-[var(--color-text)]"
                      >
                        {SOCIAL_LABEL[link.platform] ?? link.platform}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Report Flag ── */}
              <div className="py-2 text-center">
                <p className="text-xs text-[var(--color-text-faint)]">
                  هل هذه المعلومات غير صحيحة؟{" "}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[var(--color-error)]
                               hover:underline transition-colors"
                  >
                    <Flag className="w-3 h-3" />
                    أبلغ عن خطأ
                  </button>
                </p>
              </div>
            </div>

            {/* ── LEFT COLUMN — Sidebar ──────────────────────── */}
            <div className="space-y-4">
              {/* ── Contact Card ── */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">
                    تواصل معنا
                  </h2>
                </div>

                <div className="p-4 space-y-3">
                  {/* WhatsApp CTA — primary green button */}
                  {waLink && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-lg
                                 bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white
                                 transition-colors hover:bg-[#128C7E] active:bg-[#075E54]"
                    >
                      {/* WhatsApp SVG icon */}
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 fill-current"
                        aria-hidden
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      مراسلة عبر واتساب
                    </a>
                  )}

                  {/* Phone numbers */}
                  {otherPhones.map((phone) => (
                    <a
                      key={phone.id}
                      href={`tel:${phone.number}`}
                      dir="ltr"
                      className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)]
                                 px-3 py-2 text-sm text-[var(--color-text)] transition-colors
                                 hover:bg-[var(--color-surface-offset)]"
                    >
                      <Phone className="w-4 h-4 shrink-0 text-[var(--color-primary)]" />
                      <span className="font-mono flex-1">{phone.number}</span>
                      {phone.isPrimary && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          أساسي
                        </span>
                      )}
                    </a>
                  ))}

                  {/* Social icons row (Facebook, etc.) */}
                  {listing.socialLinks.length > 0 && (
                    <div className="flex gap-2 pt-1">
                      {listing.socialLinks.slice(0, 5).map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={
                            SOCIAL_LABEL[link.platform] ?? link.platform
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full
                                     border border-[var(--color-border)] text-[var(--color-text-muted)]
                                     transition-colors hover:bg-[var(--color-surface-offset)]
                                     hover:text-[var(--color-text)]"
                        >
                          <SocialIcon platform={link.platform} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Address Card ── */}
              {listing.addressAr && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
                    <MapPin className="w-4 h-4 text-[var(--color-primary)]" />
                    <h2 className="text-sm font-semibold text-[var(--color-text)]">
                      العنوان
                    </h2>
                  </div>

                  <div className="p-4 space-y-3">
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {listing.addressAr}
                    </p>

                    {/* Map */}
                    {staticMapUrl ? (
                      <a
                        href={`https://www.google.com/maps?q=${listing.latitude},${listing.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-lg"
                      >
                        <Image
                          src={staticMapUrl}
                          alt={`موقع ${listing.nameAr}`}
                          width={600}
                          height={240}
                          loading="lazy"
                          className="w-full object-cover transition-opacity hover:opacity-90"
                        />
                      </a>
                    ) : (
                      /* Map placeholder — shown when no coords or no API key */
                      <div
                        className="flex flex-col items-center justify-center gap-2 rounded-lg
                                   bg-[var(--color-surface-offset)] py-8 text-center"
                      >
                        <MapPin className="w-6 h-6 text-[var(--color-text-faint)]" />
                        <p className="text-xs text-[var(--color-text-faint)]">
                          خريطة الموقع غير متوفرة حالياً
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Working Hours Card (CLIENT — day highlight needs browser Date) ── */}
              {sortedHours.length > 0 && (
                <WorkingHoursCard
                  hours={sortedHours.map((h) => ({
                    id: h.id,
                    dayOfWeek: String(h.dayOfWeek),
                    isClosed: h.isClosed,
                    openTime: h.openTime,
                    closeTime: h.closeTime,
                  }))}
                  viewCount={listing.viewCount ?? 0}
                />
              )}
            </div>
            {/* ── End sidebar ── */}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── SocialIcon Helper ────────────────────────────────────────────────────────

function SocialIcon({ platform }: { platform: string }) {
  switch (platform) {
    case "FACEBOOK":
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "INSTAGRAM":
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case "YOUTUBE":
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "TELEGRAM":
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      );
    case "TIKTOK":
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );
    case "WEBSITE":
      return <ExternalLink className="w-4 h-4" aria-hidden />;
    default:
      return <ExternalLink className="w-4 h-4" aria-hidden />;
  }
}
