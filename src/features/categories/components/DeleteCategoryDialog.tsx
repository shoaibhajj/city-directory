"use client";

import { useState, useTransition } from "react";
import { deleteCategory, deleteSubcategory } from "../actions";

interface Props {
  id: string;
  nameAr: string;
  type: "category" | "subcategory";
  onClose: () => void;
}

export function DeleteCategoryDialog({ id, nameAr, type, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    startTransition(async () => {
      setError(null);
      const result =
        type === "category"
          ? await deleteCategory(id)
          : await deleteSubcategory(id);

      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div dir="rtl">
      <p className="text-sm text-muted-foreground mb-4">
        هل أنت متأكد من حذف{" "}
        <strong className="text-foreground font-semibold">{nameAr}</strong>؟
        <br />
        لا يمكن التراجع عن هذا الإجراء.
      </p>

      {error && (
        <div
          role="alert"
          className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mb-4"
        >
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90 disabled:opacity-60 transition-colors"
        >
          {isPending ? "جارٍ الحذف…" : "تأكيد الحذف"}
        </button>
        <button
          onClick={onClose}
          disabled={isPending}
          className="px-4 py-2 border border-border rounded-md text-sm hover:bg-accent transition-colors disabled:opacity-60"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
