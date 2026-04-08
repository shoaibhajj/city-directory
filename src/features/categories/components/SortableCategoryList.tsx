"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderCategories } from "../actions";
import type { AdminCategory } from "../queries";

// ── Single row ─────────────────────────────────────────────────────────────────
interface RowProps {
  category: AdminCategory;
  onEdit: (cat: AdminCategory) => void;
  onDelete: (cat: AdminCategory) => void;
  onAddSubcategory: (cat: AdminCategory) => void;
  onToggleVisibility: (id: string, current: boolean) => void;
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
  onAddSubcategory,
  onToggleVisibility,
}: RowProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-card mb-2"
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 touch-none shrink-0"
          aria-label="اسحب لإعادة الترتيب"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="4" cy="3" r="1.2" />
            <circle cx="4" cy="7" r="1.2" />
            <circle cx="4" cy="11" r="1.2" />
            <circle cx="10" cy="3" r="1.2" />
            <circle cx="10" cy="7" r="1.2" />
            <circle cx="10" cy="11" r="1.2" />
          </svg>
        </button>

        {/* Icon */}
        <span className="text-xl w-7 text-center shrink-0" aria-hidden>
          {category.icon ?? "📁"}
        </span>

        {/* Names */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">
            {category.nameAr}
          </p>
          <p className="text-muted-foreground text-xs truncate">
            {category.nameEn}
          </p>
        </div>

        {/* Listing count — uses `listings` relation from schema */}
        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
          {category._count.listings}
        </span>

        {/* Visibility */}
        <button
          onClick={() => onToggleVisibility(category.id, category.isVisible)}
          className={`text-xs px-2 py-1 rounded-md font-medium transition-colors shrink-0 ${
            category.isVisible
              ? "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {category.isVisible ? "ظاهر" : "مخفي"}
        </button>

        {/* Expand subcategories toggle */}
        {category.subcategories.length > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-muted-foreground hover:text-foreground p-1 shrink-0"
            aria-label={expanded ? "طي" : "توسيع"}
            aria-expanded={expanded}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path
                d="M2 5l5 5 5-5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Add subcategory */}
        <button
          onClick={() => onAddSubcategory(category)}
          className="text-primary hover:text-primary/80 p-1 shrink-0"
          aria-label="إضافة تصنيف فرعي"
          title="إضافة تصنيف فرعي"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M7.5 2v11M2 7.5h11" strokeLinecap="round" />
          </svg>
        </button>

        {/* Edit */}
        <button
          onClick={() => onEdit(category)}
          className="text-muted-foreground hover:text-foreground p-1 shrink-0"
          aria-label={`تعديل ${category.nameAr}`}
          title="تعديل"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="M9.5 2l2.5 2.5L4 13H1.5v-2.5L9.5 2z"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(category)}
          className="text-destructive hover:text-destructive/80 p-1 shrink-0"
          aria-label={`حذف ${category.nameAr}`}
          title="حذف"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="M2.5 3.5h9M5.5 3.5V2h3v1.5M4.5 3.5l.5 8h4l.5-8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Subcategories */}
      {expanded && category.subcategories.length > 0 && (
        <div className="border-t border-border px-3 pb-2 pt-1.5 space-y-1">
          {category.subcategories.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center gap-2 py-1 px-2 rounded-md bg-muted/50 text-sm"
            >
              <span className="text-base" aria-hidden>
                {sub.icon ?? "▸"}
              </span>
              <span className="flex-1 font-medium">{sub.nameAr}</span>
              <span className="text-muted-foreground text-xs">
                {sub.nameEn}
              </span>
              <span
                className={`text-xs ${sub.isVisible ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
              >
                {sub.isVisible ? "ظاهر" : "مخفي"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sortable list ──────────────────────────────────────────────────────────────
interface Props {
  initialCategories: AdminCategory[];
  onEdit: (cat: AdminCategory) => void;
  onDelete: (cat: AdminCategory) => void;
  onAddSubcategory: (cat: AdminCategory) => void;
  onToggleVisibility: (id: string, current: boolean) => void;
}

export function SortableCategoryList({
  initialCategories,
  onEdit,
  onDelete,
  onAddSubcategory,
  onToggleVisibility,
}: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);

    // Optimistic update — UI responds instantly
    setCategories(reordered);

    startTransition(async () => {
      setSaveError(null);
      const result = await reorderCategories({
        items: reordered.map((c, i) => ({ id: c.id, displayOrder: i })),
      });
      if (!result.success) {
        // Rollback on failure
        setCategories(initialCategories);
        setSaveError("فشل حفظ الترتيب — تم التراجع. حاول مجدداً.");
      }
    });
  }

  return (
    <div>
      {saveError && (
        <p
          role="alert"
          className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mb-3"
        >
          {saveError}
        </p>
      )}
      {isPending && (
        <p className="text-xs text-muted-foreground mb-2 animate-pulse">
          جارٍ حفظ الترتيب…
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={categories.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubcategory={onAddSubcategory}
              onToggleVisibility={onToggleVisibility}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
