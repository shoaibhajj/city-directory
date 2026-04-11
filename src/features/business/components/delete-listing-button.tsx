"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { softDeleteListingAction } from "@/features/business/actions";

export function DeleteListingButton({ listingId }: { listingId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm("هل أنت متأكد من حذف هذه القائمة؟ لا يمكن التراجع.")) return;

    startTransition(async () => {
      try {
        await softDeleteListingAction(listingId);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "حدث خطأ ما");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="text-destructive hover:underline disabled:opacity-60"
    >
      {isPending ? "..." : "حذف"}
    </button>
  );
}
