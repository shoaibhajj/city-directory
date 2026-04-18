"use client";

import { useTransition } from "react";
import { saveSettingsAction } from "@/features/admin/actions";
import { useRouter } from "next/navigation";

interface Props {
  locale: string;
  settings: Map<string, string>;
  keys: string[];
}

export function SettingsForm({ locale, settings, keys }: Props) {
  void locale; // available for language-specific fields
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = async (formData: FormData) => {
    startTransition(async () => {
      const updates: Record<string, string> = {};
      for (const key of keys) {
        const value = formData.get(key);
        if (value) updates[key] = value.toString();
      }
      await saveSettingsAction(updates);
      router.refresh();
    });
  };

  return (
    <form action={handleSave} className="space-y-4 max-w-xl">
      {keys.map((key) => (
        <div key={key}>
          <label className="block text-sm font-medium mb-1">{key}</label>
          <input
            type="text"
            name={key}
            defaultValue={settings.get(key) || ""}
            className="w-full p-2 border rounded"
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-primary text-white rounded"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}