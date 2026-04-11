"use client";
"use no memo";
import { useCallback } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { BusinessProfile, SocialLink } from "@prisma/client";
import {
  UpdateSocialSchema,
  type UpdateSocialInput,
} from "@/features/business/schemas";
import { updateListingAction } from "@/features/business/actions";
import { useDebouncedAutosave } from "./use-debounced-autosave";
import { AutosaveIndicator } from "./autosave-indicator";

type SocialFormProps = {
  listing: Pick<BusinessProfile, "id"> & {
    socialLinks: Pick<SocialLink, "id" | "platform" | "url">[];
  };
};

export function SocialForm({ listing }: SocialFormProps) {
  const form = useForm<UpdateSocialInput>({
    resolver: zodResolver(UpdateSocialSchema),
    defaultValues: {
      socialLinks: listing.socialLinks.map((l) => ({
        id: l.id,
        platform: l.platform,
        url: l.url,
      })),
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "socialLinks",
  });

  const values = useWatch({ control: form.control });

  const handleSave = useCallback(
    async (next: UpdateSocialInput) => {
      await updateListingAction(listing.id, "social", next);
    },
    [listing.id],
  );

  const { state } = useDebouncedAutosave({
    value: values as UpdateSocialInput,
    isValid: form.formState.isValid,
    onSave: handleSave,
    delay: 2000,
  });

  return (
    <form className="space-y-6">
      <AutosaveIndicator state={state} />

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">روابط التواصل</h2>
        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => append({ platform: "FACEBOOK", url: "" })}
        >
          إضافة رابط
        </button>
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-3 rounded-lg border p-4 md:grid-cols-3"
          >
            <select
              className="rounded-md border px-3 py-2"
              {...form.register(`socialLinks.${index}.platform`)}
            >
              <option value="FACEBOOK">Facebook</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="TELEGRAM">Telegram</option>
              <option value="YOUTUBE">YouTube</option>
              <option value="TIKTOK">TikTok</option>
              <option value="WEBSITE">Website</option>
              <option value="OTHER">Other</option>
            </select>

            <input
              dir="ltr"
              placeholder="https://..."
              className="rounded-md border px-3 py-2"
              {...form.register(`socialLinks.${index}.url`)}
            />

            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm text-destructive"
              onClick={() => remove(index)}
            >
              حذف
            </button>
          </div>
        ))}
      </div>
    </form>
  );
}
