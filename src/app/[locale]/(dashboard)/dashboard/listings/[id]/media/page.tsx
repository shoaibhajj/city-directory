import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMediaByListing } from "@/features/media/queries";
import { MediaStatus, MediaType } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MediaUploadForm } from "@/features/media/components/forms/MediaUploadForm";

interface PageProps {
  params: { locale: string; id: string };
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "media",
  });
  return { title: t("pageTitle") };
}

export default async function ListingMediaPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${params.locale}/auth/sign-in` as never);
  }

  // Ownership enforced here — user can only access their own listing's media
  const listing = await prisma.businessProfile.findFirst({
    where: { id: params.id, ownerId: session.user.id },
    select: { id: true, nameAr: true, nameEn: true, slug: true },
  });
  if (!listing) notFound();

  const rawMedia = await getMediaByListing(listing.id);

  // Serialize to plain objects — Client Components cannot receive Prisma models
  const mediaItems = rawMedia.map((m) => ({
    id: m.id,
    type: m.type as MediaType,
    status: m.status as MediaStatus,
    url: m.url,
    thumbnailUrl: m.thumbnailUrl,
    durationSeconds: m.durationSeconds,
    rejectionReason: m.rejectionReason,
  }));

  const steps = [
    {
      label: "المعلومات الأساسية",
      href: `/ar/dashboard/listings/${listing.id}`,
    },
    {
      label: "بيانات التواصل",
      href: `/ar/dashboard/listings/${listing.id}/contact`,
    },
    {
      label: "ساعات العمل",
      href: `/ar/dashboard/listings/${listing.id}/hours`,
    },
    {
      label: "التواصل الاجتماعي",
      href: `/ar/dashboard/listings/${listing.id}/social`,
    },
    {
      label: "الصور والفيديوهات",
      href: `/ar/dashboard/listings/${listing.id}/media`,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          الصور والفيديوهات
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {listing.nameAr}
          {listing.nameEn && (
            <span className="text-muted-foreground/60">
              {" "}
              · {listing.nameEn}
            </span>
          )}
        </p>
      </div>

      {/* Multi-step breadcrumb */}
      <nav aria-label="خطوات التحرير" className="overflow-x-auto">
        <ol className="flex gap-1.5 min-w-max">
          {steps.map((step, i) => {
            const isActive = i === 4;
            return (
              <li key={step.label}>
                <a
                  href={step.href}
                  className={[
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground pointer-events-none"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  ].join(" ")}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span className="opacity-60">{i + 1}.</span>
                  {step.label}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Upload Form */}
      <MediaUploadForm listingId={listing.id} initialMedia={mediaItems} />

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4 border-t border-border">
        <a
          href={`/ar/dashboard/listings/${listing.id}/social`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← السابق: التواصل الاجتماعي
        </a>
        <Link
          href="/ar/dashboard/listings"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          حفظ والعودة للقائمة
        </Link>
      </div>
    </div>
  );
}
