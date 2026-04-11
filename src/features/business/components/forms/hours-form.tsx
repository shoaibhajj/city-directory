/* eslint-disable react-hooks/incompatible-library */
"use client";

import { useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { BusinessProfile, WorkingHours } from "@prisma/client";
import { DayOfWeek } from "@prisma/client";
import {
  UpdateHoursSchema,
  type UpdateHoursInput,
} from "@/features/business/schemas";
import { updateListingAction } from "@/features/business/actions";
import { useDebouncedAutosave } from "./use-debounced-autosave";
import { AutosaveIndicator } from "./autosave-indicator";

type HoursFormProps = {
  listing: Pick<BusinessProfile, "id"> & {
    workingHours: Pick<
      WorkingHours,
      "dayOfWeek" | "isClosed" | "openTime" | "closeTime"
    >[];
  };
};

const DAY_LABELS: Record<DayOfWeek, string> = {
  SATURDAY: "السبت",
  SUNDAY: "الأحد",
  MONDAY: "الاثنين",
  TUESDAY: "الثلاثاء",
  WEDNESDAY: "الأربعاء",
  THURSDAY: "الخميس",
  FRIDAY: "الجمعة",
};

const DAY_ORDER: DayOfWeek[] = [
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
];

export function HoursForm({ listing }: HoursFormProps) {
  // Sort hours to match our display order
  const sortedHours = DAY_ORDER.map((day) => {
    const found = listing.workingHours.find((h) => h.dayOfWeek === day);
    return {
      dayOfWeek: day,
      isClosed: found?.isClosed ?? true,
      openTime: found?.openTime ?? null,
      closeTime: found?.closeTime ?? null,
    };
  });

  const form = useForm<UpdateHoursInput>({
    resolver: zodResolver(UpdateHoursSchema),
    defaultValues: { hours: sortedHours },
    mode: "onChange",
  });

  const values = useWatch({ control: form.control });

  const handleSave = useCallback(
    async (next: UpdateHoursInput) => {
      await updateListingAction(listing.id, "hours", next);
    },
    [listing.id],
  );

  const { state } = useDebouncedAutosave({
    value: values as UpdateHoursInput,
    isValid: form.formState.isValid,
    onSave: handleSave,
    delay: 2000,
  });

  return (
    <form className="space-y-6">
      <AutosaveIndicator state={state} />

      <div className="space-y-3">
        {DAY_ORDER.map((day, index) => {
          const isClosed = form.watch(`hours.${index}.isClosed`);

          return (
            <div
              key={day}
              className="grid gap-4 rounded-lg border p-4 md:grid-cols-4 md:items-center"
            >
              <div className="font-medium">{DAY_LABELS[day]}</div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...form.register(`hours.${index}.isClosed`)}
                />
                مغلق
              </label>

              <input
                type="time"
                className="rounded-md border px-3 py-2 disabled:opacity-50"
                disabled={isClosed}
                {...form.register(`hours.${index}.openTime`)}
              />

              <input
                type="time"
                className="rounded-md border px-3 py-2 disabled:opacity-50"
                disabled={isClosed}
                {...form.register(`hours.${index}.closeTime`)}
              />
            </div>
          );
        })}
      </div>
    </form>
  );
}
