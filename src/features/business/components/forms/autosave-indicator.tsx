"use client";

type AutosaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const stateLabel: Record<AutosaveState, string> = {
  idle: "لا توجد تغييرات",
  dirty: "لديك تغييرات غير محفوظة",
  saving: "جاري الحفظ...",
  saved: "تم الحفظ",
  error: "فشل الحفظ",
};

const stateColor: Record<AutosaveState, string> = {
  idle: "text-muted-foreground",
  dirty: "text-amber-600",
  saving: "text-blue-600",
  saved: "text-green-600",
  error: "text-destructive",
};

export function AutosaveIndicator({ state }: { state: AutosaveState }) {
  return (
    <p className={`text-sm ${stateColor[state]}`} aria-live="polite">
      {stateLabel[state]}
    </p>
  );
}

export type { AutosaveState };
