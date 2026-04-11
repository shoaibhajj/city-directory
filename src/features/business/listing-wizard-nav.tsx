// src/components/business/listing-wizard-nav.tsx

import { Link } from "@/i18n/navigation";

const steps = [
  { label: "Basic info", suffix: "" },
  { label: "Contact", suffix: "/contact" },
  { label: "Hours", suffix: "/hours" },
  { label: "Social", suffix: "/social" },
  { label: "Media", suffix: "/media" },
];

export function ListingWizardNav({
  listingId,
}: {
  locale: string;
  listingId: string;
}) {
  const base = `/dashboard/listings/${listingId}`;

  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {steps.map((step) => (
        <Link
          key={step.label}
          href={`${base}${step.suffix}`}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
        >
          {step.label}
        </Link>
      ))}
    </nav>
  );
}
