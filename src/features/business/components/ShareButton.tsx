"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  title: string;
  url: string;
}

export function ShareButton({ title, url }: Props) {
  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled — not an error
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ الرابط");
    }
  }

  return (
    <button
      onClick={handleShare}
      aria-label="مشاركة"
      className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)]
                 px-3 py-1.5 text-xs text-[var(--color-text-muted)] transition-colors
                 hover:bg-[var(--color-surface-offset)] hover:text-[var(--color-text)]"
    >
      <Share2 className="w-3.5 h-3.5" />
      مشاركة
    </button>
  );
}
