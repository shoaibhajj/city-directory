"use client";

import { markAllNotificationsRead } from "@/features/notifications/actions";
import { useTransition } from "react";

interface MarkAllReadButtonProps {
  count: number;
}

export function MarkAllReadButton({ count }: MarkAllReadButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          await markAllNotificationsRead();
        });
      }}
      disabled={isPending}
      className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
    >
      {isPending ? "..." : ` ${count > 0 ? `(${count})` : ""} ${"تم تحديد الكل كمقروء"}`}
    </button>
  );
}