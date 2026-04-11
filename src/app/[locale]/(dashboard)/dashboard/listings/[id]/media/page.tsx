import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ListingWizardNav } from "@/features/business/listing-wizard-nav";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function ListingMediaPage({ params }: Props) {
  const { locale, id } = await params;
  const session = await auth();

  const listing = await prisma.businessProfile.findFirst({
    where: { id, ownerId: session!.user.id, deletedAt: null },
  });

  if (!listing) notFound();

  //   const base = `/${locale}/dashboard/listings/${id}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <ListingWizardNav locale={locale} listingId={listing.id} />

      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        <p className="text-base font-medium">رفع الصور والفيديو</p>
        <p className="mt-1 text-sm">سيتوفر هذا القسم في المرحلة الخامسة</p>
      </div>
    </div>
  );
}
