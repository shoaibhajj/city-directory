import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { ListingWizardNav } from "@/features/business/listing-wizard-nav";
import { BasicInfoForm } from "@/features/business/components/forms/basic-info-form";
import { prisma } from "@/lib/prisma";

export default async function ListingBasicInfoPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/ar/sign-in");

  const [listing, categories, cities] = await Promise.all([
    prisma.businessProfile.findFirst({
      where: { id, ownerId: session!.user.id, deletedAt: null },
    }),
    prisma.category.findMany({
      where: { isVisible: true },
      include: {
        subcategories: {
          where: { isVisible: true },
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.city.findMany({
      orderBy: { nameAr: "asc" },
    }),
  ]);

  if (!listing) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{listing.nameAr}</h1>
        <p className="text-muted-foreground">Step 1: Basic information</p>
      </div>

      <ListingWizardNav locale={locale} listingId={listing.id} />
      <BasicInfoForm
        listing={listing}
        categories={categories}
        cities={cities}
      />
    </div>
  );
}
