"use client";

import { Clock, Eye } from "lucide-react";

const DAY_LABELS: Record<string, string> = {
  SATURDAY: "السبت",
  SUNDAY: "الأحد",
  MONDAY: "الاثنين",
  TUESDAY: "الثلاثاء",
  WEDNESDAY: "الأربعاء",
  THURSDAY: "الخميس",
  FRIDAY: "الجمعة",
};

// JS getDay() → 0=Sunday … 6=Saturday
const JS_TO_PRISMA: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

interface Hour {
  id: string;
  dayOfWeek: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

interface Props {
  hours: Hour[];
  viewCount: number;
}

export function WorkingHoursCard({ hours, viewCount }: Props) {
  const today = JS_TO_PRISMA[new Date().getDay()] ?? "";

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
        <Clock className="w-4 h-4 text-[var(--color-primary)]" />
        <h2 className="font-semibold text-sm text-[var(--color-text)]">
          ساعات العمل
        </h2>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[var(--color-divider)]">
        {hours.map((day) => {
          const isToday = String(day.dayOfWeek) === today;
          return (
            <div
              key={day.id}
              className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                isToday ? "bg-[var(--color-primary-highlight)]" : ""
              }`}
            >
              <span
                className={`font-medium ${
                  isToday
                    ? "text-[var(--color-primary)] font-bold"
                    : "text-[var(--color-text)]"
                }`}
              >
                {DAY_LABELS[String(day.dayOfWeek)] ?? String(day.dayOfWeek)}
              </span>

              {day.isClosed ? (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  مغلق
                </span>
              ) : (
                <span
                  dir="ltr"
                  className={`tabular-nums ${
                    isToday
                      ? "text-[var(--color-primary)] font-bold"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {day.openTime ?? "—"} - {day.closeTime ?? "—"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* View count footer */}
      <div className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-[var(--color-divider)]">
        <Eye className="w-3.5 h-3.5 text-[var(--color-text-faint)]" />
        <span className="text-xs text-[var(--color-text-muted)]">
          تمت المشاهدة {viewCount.toLocaleString("ar-SY")} مرة
        </span>
      </div>
    </div>
  );
}
