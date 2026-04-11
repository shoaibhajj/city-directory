import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getListingByIdForOwner } from "@/features/business/queries";
import { ListingWizardNav } from "@/features/business/listing-wizard-nav";
import { HoursForm } from "@/features/business/components/forms/hours-form";

export default async function ListingHoursPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/ar/sign-in");

  const listing = await getListingByIdForOwner(id, session.user.id);
  if (!listing) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{listing.nameAr}</h1>
        <p className="text-muted-foreground">Step 3: Working hours</p>
      </div>

      <ListingWizardNav locale={locale} listingId={listing.id} />
      <HoursForm listing={listing} />
    </div>
  );
}
