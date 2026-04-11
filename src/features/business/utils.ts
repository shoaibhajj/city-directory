// src/features/business/utils.ts
import { DayOfWeek, ListingStatus } from "@prisma/client";
import { transliterate } from "transliteration";

import { prisma } from "@/lib/prisma";

export const WEEK_DAY_VALUES: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export function canTransitionTo(
  current: ListingStatus,
  next: ListingStatus,
): boolean {
  const transitions: Record<ListingStatus, ListingStatus[]> = {
    DRAFT: ["ACTIVE"],
    ACTIVE: ["SUSPENDED"],
    SUSPENDED: ["ACTIVE"],
  };

  return transitions[current]?.includes(next) ?? false;
}

function slugifyArabicName(value: string) {
  return transliterate(value, { unknown: "" })
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateSlug(
  nameAr: string,
  excludeBusinessId?: string,
): Promise<string> {
  const base = slugifyArabicName(nameAr) || "listing";
  let candidate = base;
  let counter = 2;

  while (true) {
    const existing = await prisma.businessProfile.findFirst({
      where: {
        slug: candidate,
        ...(excludeBusinessId
          ? {
              NOT: { id: excludeBusinessId },
            }
          : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

export function buildSearchableText(input: {
  nameAr?: string | null;
  nameEn?: string | null;
  descriptionAr?: string | null;
  addressAr?: string | null;
}) {
  return [
    input.nameAr ?? "",
    input.nameEn ?? "",
    input.descriptionAr ?? "",
    input.addressAr ?? "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildBusinessPath(params: {
  locale: string;
  citySlug: string;
  categorySlug: string;
  businessSlug: string;
}) {
  return `/${params.locale}/${params.citySlug}/${params.categorySlug}/${params.businessSlug}`;
}

export function buildJsonDiff(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  const diff: Record<string, { before: unknown; after: unknown }> = {};

  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const before = previous[key];
    const after = next[key];

    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diff[key] = { before, after };
    }
  }

  return diff;
}
