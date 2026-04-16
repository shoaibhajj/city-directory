// src/features/business/schemas.ts
import { DayOfWeek, SocialPlatform } from "@prisma/client";
import { z } from "zod";

export const PhoneSchema = z.object({
  id: z.string().optional(),
  label: z
    .enum(["MOBILE", "LANDLINE", "WHATSAPP", "OTHER"])
    .optional()
    .nullable(),
  number: z.string().min(7).max(32),
  isPrimary: z.boolean().default(false), // ← NO .optional() before .default()
});

export const WorkingHourSchema = z
  .object({
    dayOfWeek: z.nativeEnum(DayOfWeek),
    isClosed: z.boolean(),
    openTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
    closeTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (!value.isClosed && (!value.openTime || !value.closeTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Open and close time are required when the day is not closed",
      });
    }
  });

export const SocialLinkSchema = z.object({
  id: z.string().optional(),
  platform: z.nativeEnum(SocialPlatform),
  url: z.string().url(),
});

export const CreateListingSchema = z.object({
  nameAr: z.string().min(2).max(120),
  nameEn: z.string().max(120).optional().or(z.literal("")),
  descriptionAr: z.string().max(4000).optional().or(z.literal("")),
  descriptionEn: z.string().max(4000).optional().or(z.literal("")),
  categoryId: z.string().cuid(),
  subcategoryId: z.string().cuid().optional().nullable(),
  cityId: z.string().cuid(),
});

export const UpdateBasicInfoSchema = CreateListingSchema.extend({
  subcategoryId: z.string().cuid().nullable().optional(),
});

export const UpdateContactSchema = z.object({
  addressAr: z.string().max(500).optional().or(z.literal("")),
  addressEn: z.string().max(500).optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phones: z.array(PhoneSchema).min(1),
});

export const UpdateHoursSchema = z.object({
  hours: z.array(WorkingHourSchema).length(7),
});

export const UpdateSocialSchema = z.object({
  socialLinks: z.array(SocialLinkSchema).max(10),
});

export const SearchSchema = z.object({
  query: z.string().min(2).max(100),
  citySlug: z.string().max(100).default("al-nabik"),
});

// Use z.input for RHF resolver compatibility (pre-transform types)
export type CreateListingInput = z.input<typeof CreateListingSchema>;
export type UpdateBasicInfoInput = z.input<typeof UpdateBasicInfoSchema>;
export type UpdateContactInput = z.input<typeof UpdateContactSchema>;
export type UpdateHoursInput = z.input<typeof UpdateHoursSchema>;
export type UpdateSocialInput = z.input<typeof UpdateSocialSchema>;
export type SearchInput = z.input<typeof SearchSchema>;
