"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitListingAction } from "@/features/business/actions";

type Props = { listingId: string; locale: string };

export function SubmitListingButton({ listingId, locale }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit() {
    startTransition(async () => {
      try {
        await submitListingAction(listingId);
        router.push(`/${locale}/dashboard/listings` as never);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "حدث خطأ ما");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleSubmit}
      disabled={isPending}
      className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {isPending ? "جارٍ النشر..." : "نشر القائمة"}
    </button>
  );
}
