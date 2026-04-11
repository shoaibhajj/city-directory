import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getListingByIdForOwner } from "@/features/business/queries";
import { ListingWizardNav } from "@/features/business/listing-wizard-nav";
import { SocialForm } from "@/features/business/components/forms/social-form";
import { SubmitListingButton } from "@/features/business/components/submit-listing-button";

export default async function ListingSocialPage({
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
        <p className="text-muted-foreground">Step 4: Social links</p>
      </div>

      <ListingWizardNav locale={locale} listingId={listing.id} />
      <SocialForm listing={listing} />
      {listing.status === "DRAFT" && (
        <div className="flex justify-end pt-4 border-t">
          <SubmitListingButton listingId={listing.id} locale={locale} />
        </div>
      )}
    </div>
  );
}
