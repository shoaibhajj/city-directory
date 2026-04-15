import { z } from "zod";

// MediaType values valid for Phase 5 uploads
// IMAGE is excluded — it was the Phase 2 generic value, not used in new code
export const UploadMediaTypeSchema = z.enum([
  "COVER",
  "LOGO",
  "PHOTO",
  "VIDEO",
]);
export type UploadMediaType = z.infer<typeof UploadMediaTypeSchema>;

export const GeneratePresignedUrlSchema = z.object({
  listingId: z.string().cuid(),
  type: UploadMediaTypeSchema,
});

export const ConfirmUploadSchema = z.object({
  mediaFileId: z.string().cuid(),
  cloudinaryPublicId: z.string().min(1, "cloudinaryPublicId is required"),
  resourceType: z.enum(["image", "video"]),
});

export const DeleteMediaSchema = z.object({
  mediaFileId: z.string().cuid(),
});

export const ReorderMediaSchema = z.object({
  listingId: z.string().cuid(),
  orderedIds: z.array(z.string().cuid()).min(1),
});

export const ApproveMediaSchema = z.object({
  mediaFileId: z.string().cuid(),
});

export const RejectMediaSchema = z.object({
  mediaFileId: z.string().cuid(),
  reason: z.string().min(5, "يجب أن يكون سبب الرفض 5 أحرف على الأقل").max(500),
});
