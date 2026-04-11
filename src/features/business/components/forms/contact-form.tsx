"use client";
"use no memo";
import { useCallback } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { BusinessProfile, PhoneNumber } from "@prisma/client";
import {
  UpdateContactSchema,
  type UpdateContactInput,
} from "@/features/business/schemas";
import { updateListingAction } from "@/features/business/actions";
import { useDebouncedAutosave } from "./use-debounced-autosave";
import { AutosaveIndicator } from "./autosave-indicator";

type ContactFormProps = {
  listing: Pick<
    BusinessProfile,
    "id" | "addressAr" | "addressEn" | "latitude" | "longitude"
  > & {
    phoneNumbers: Pick<PhoneNumber, "id" | "label" | "number" | "isPrimary">[];
  };
};

export function ContactForm({ listing }: ContactFormProps) {
  const form = useForm<UpdateContactInput>({
    resolver: zodResolver(UpdateContactSchema),
    defaultValues: {
      addressAr: listing.addressAr ?? "",
      addressEn: listing.addressEn ?? "",
      latitude: listing.latitude ?? null,
      longitude: listing.longitude ?? null,
      phones: listing.phoneNumbers.map((p) => ({
        id: p.id,
        label: (p.label ?? "MOBILE") as
          | "MOBILE"
          | "LANDLINE"
          | "WHATSAPP"
          | "OTHER",
        number: p.number,
        isPrimary: p.isPrimary,
      })),
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "phones",
  });

  const values = useWatch({ control: form.control });

  const handleSave = useCallback(
    async (next: UpdateContactInput) => {
      await updateListingAction(listing.id, "contact", next);
    },
    [listing.id],
  );

  const { state } = useDebouncedAutosave({
    value: values as UpdateContactInput,
    isValid: form.formState.isValid,
    onSave: handleSave,
    delay: 2000,
  });

  return (
    <form className="space-y-6">
      <AutosaveIndicator state={state} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">أرقام الهاتف</label>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() =>
              append({
                label: "MOBILE",
                number: "",
                isPrimary: fields.length === 0,
              })
            }
          >
            إضافة رقم
          </button>
        </div>

        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-3 rounded-lg border p-4 md:grid-cols-4"
          >
            <select
              className="rounded-md border px-3 py-2"
              {...form.register(`phones.${index}.label`)}
            >
              <option value="MOBILE">موبايل</option>
              <option value="LANDLINE">أرضي</option>
              <option value="WHATSAPP">واتساب</option>
              <option value="OTHER">أخرى</option>
            </select>

            <input
              dir="ltr"
              placeholder="+963..."
              className="rounded-md border px-3 py-2 md:col-span-2"
              {...form.register(`phones.${index}.number`)}
            />

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...form.register(`phones.${index}.isPrimary`)}
                />
                أساسي
              </label>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm text-destructive"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label htmlFor="addressAr" className="text-sm font-medium">
          العنوان بالعربية
        </label>
        <textarea
          id="addressAr"
          dir="rtl"
          rows={3}
          className="w-full rounded-md border px-3 py-2"
          {...form.register("addressAr")}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="addressEn" className="text-sm font-medium">
          Address in English
        </label>
        <textarea
          id="addressEn"
          dir="ltr"
          rows={3}
          className="w-full rounded-md border px-3 py-2"
          {...form.register("addressEn")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="latitude" className="text-sm font-medium">
            Latitude
          </label>
          <input
            id="latitude"
            type="number"
            step="any"
            className="w-full rounded-md border px-3 py-2"
            {...form.register("latitude", {
              setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
            })}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="longitude" className="text-sm font-medium">
            Longitude
          </label>
          <input
            id="longitude"
            type="number"
            step="any"
            className="w-full rounded-md border px-3 py-2"
            {...form.register("longitude", {
              setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
            })}
          />
        </div>
      </div>
    </form>
  );
}
