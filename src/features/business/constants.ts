// src/features/business/constants.ts
import { DayOfWeek } from "@prisma/client";
export const BUSINESS_CREATE_RATE_LIMIT_SECONDS = 60 * 60 * 24; // 24 hours
export const BUSINESS_AUTOSAVE_DELAY_MS = 2000;
export const WEEK_DAYS: DayOfWeek[] = [
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
];
export const PREGENERATED_LISTINGS_LIMIT = 100;
