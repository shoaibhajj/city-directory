"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/shared/Modal";
import { CategoryForm } from "@/features/categories/components/CategoryForm";
import { SubcategoryForm } from "@/features/categories/components/SubcategoryForm";
import { DeleteCategoryDialog } from "@/features/categories/components/DeleteCategoryDialog";
import { SortableCategoryList } from "@/features/categories/components/SortableCategoryList";
import { updateCategory } from "@/features/categories/actions";
import type { AdminCategory } from "@/features/categories/queries";

// Discriminated union — TypeScript will error if you access .category on a "create" modal
type ModalState =
  | { type: "idle" }
  | { type: "create-category" }
  | { type: "edit-category"; category: AdminCategory }
  | { type: "delete-category"; category: AdminCategory }
  | { type: "create-subcategory"; parent: AdminCategory }
  | { type: "delete-subcategory"; id: string; nameAr: string };

const MODAL_TITLES: Record<ModalState["type"], string> = {
  idle: "",
  "create-category": "إضافة تصنيف جديد",
  "edit-category": "تعديل التصنيف",
  "delete-category": "حذف التصنيف",
  "create-subcategory": "إضافة تصنيف فرعي",
  "delete-subcategory": "حذف التصنيف الفرعي",
};

interface Props {
  categories: AdminCategory[];
}

export function CategoriesClient({ categories }: Props) {
  const [modal, setModal] = useState<ModalState>({ type: "idle" });
  const [, startTransition] = useTransition();

  const close = () => setModal({ type: "idle" });

  function handleToggleVisibility(id: string, current: boolean) {
    startTransition(async () => {
      await updateCategory({ id, isVisible: !current });
    });
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6" dir="rtl">
        <div>
          <h1 className="text-xl font-bold">إدارة التصنيفات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {categories.length} تصنيف · اسحب لإعادة الترتيب
          </p>
        </div>
        <button
          onClick={() => setModal({ type: "create-category" })}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M8 2v12M2 8h12" strokeLinecap="round" />
          </svg>
          إضافة تصنيف
        </button>
      </div>

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="text-center py-20 text-muted-foreground" dir="rtl">
          <p className="text-5xl mb-4" aria-hidden>
            📂
          </p>
          <p className="font-semibold text-base">لا توجد تصنيفات بعد</p>
          <p className="text-sm mt-1">ابدأ بإضافة أول تصنيف للدليل</p>
        </div>
      )}

      {/* Sortable list */}
      {categories.length > 0 && (
        <SortableCategoryList
          initialCategories={categories}
          onEdit={(cat) => setModal({ type: "edit-category", category: cat })}
          onDelete={(cat) =>
            setModal({ type: "delete-category", category: cat })
          }
          onAddSubcategory={(cat) =>
            setModal({ type: "create-subcategory", parent: cat })
          }
          onToggleVisibility={handleToggleVisibility}
        />
      )}

      {/* Modal */}
      <Modal
        open={modal.type !== "idle"}
        onClose={close}
        title={
          modal.type === "create-subcategory"
            ? `إضافة تصنيف فرعي — ${modal.parent.nameAr}`
            : MODAL_TITLES[modal.type]
        }
      >
        {modal.type === "create-category" && (
          <CategoryForm onSuccess={close} onCancel={close} />
        )}

        {modal.type === "edit-category" && (
          <CategoryForm
            initial={{
              id: modal.category.id,
              nameAr: modal.category.nameAr,
              nameEn: modal.category.nameEn,
              slug: modal.category.slug,
              icon: modal.category.icon,
              isVisible: modal.category.isVisible,
              displayOrder: modal.category.displayOrder,
              descriptionAr: modal.category.descriptionAr,
              descriptionEn: modal.category.descriptionEn,
            }}
            onSuccess={close}
            onCancel={close}
          />
        )}

        {modal.type === "delete-category" && (
          <DeleteCategoryDialog
            id={modal.category.id}
            nameAr={modal.category.nameAr}
            type="category"
            onClose={close}
          />
        )}

        {modal.type === "create-subcategory" && (
          <SubcategoryForm
            categoryId={modal.parent.id}
            onSuccess={close}
            onCancel={close}
          />
        )}

        {modal.type === "delete-subcategory" && (
          <DeleteCategoryDialog
            id={modal.id}
            nameAr={modal.nameAr}
            type="subcategory"
            onClose={close}
          />
        )}
      </Modal>
    </>
  );
}
