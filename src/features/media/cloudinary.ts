import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

export { cloudinary };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadSignatureResult {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
}

export interface VideoMetadata {
  duration: number; // seconds, may be fractional
  width: number;
  height: number;
  format: string;
  codec: string;
}

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

// ─── Signature ───────────────────────────────────────────────────────────────

/**
 * Creates a signed upload signature for direct browser-to-Cloudinary uploads.
 *
 * WHY sign instead of using unsigned presets?
 * Unsigned presets let anyone with your cloud name upload to your account.
 * A signed upload ties the request to a specific folder + publicId.
 * An attacker cannot reuse the signature for a different upload.
 */
export function generateUploadSignature(
  folder: string,
  publicId: string,
): UploadSignatureResult {
  const timestamp = Math.round(Date.now() / 1000);

  // Params MUST be sorted alphabetically — Cloudinary signature spec
  const paramsToSign = { folder, public_id: publicId, timestamp };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!,
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    folder,
    publicId,
  };
}

// ─── Asset Management ─────────────────────────────────────────────────────────

export async function deleteImageAsset(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}

export async function deleteVideoAsset(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
}

export async function getVideoMetadata(
  publicId: string,
): Promise<VideoMetadata | null> {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: "video",
      media_metadata: true,
    });
    return {
      duration: result.duration ?? 0,
      width: result.width ?? 0,
      height: result.height ?? 0,
      format: result.format ?? "",
      codec: result.video?.codec ?? "",
    };
  } catch (err) {
    console.error("[Cloudinary] getVideoMetadata failed:", err);
    return null;
  }
}

/**
 * Uploads a Node.js Buffer to Cloudinary via a writable stream.
 * Used after Sharp processing to store the final processed image.
 */
export function uploadBuffer(
  buffer: Buffer,
  options: {
    folder: string;
    publicId: string;
    resourceType?: "image" | "video" | "raw";
    format?: string;
  },
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: options.resourceType ?? "image",
        format: options.format,
        overwrite: true,
        // We processed with Sharp — tell Cloudinary not to re-compress
        quality: "auto:best",
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Empty response from Cloudinary"));
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          width: result.width ?? 0,
          height: result.height ?? 0,
          format: result.format ?? "",
          bytes: result.bytes ?? 0,
        });
      },
    );
    stream.end(buffer);
  });
}
