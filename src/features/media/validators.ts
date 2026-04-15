/**
 * Magic bytes validation — the Phase 5 security cornerstone.
 *
 * WHY magic bytes, not file extension or browser MIME type?
 *
 * Attack: rename malware.exe → photo.jpg
 *   - Extension check (`.jpg`): PASSES — extension is correct
 *   - Browser File.type (`image/jpeg`): PASSES — OS trusts the extension
 *   - Magic bytes (0xFF 0xD8 0xFF): FAILS — first bytes are `MZ` (PE header)
 *
 * Magic bytes are the first N bytes of the binary content.
 * They CANNOT be faked without making the file unreadable as that format.
 *
 * These checks run SERVER-SIDE in confirmUploadAction after the file is
 * fetched from Cloudinary. The client-side check is UX only.
 */

export const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

export interface ValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
}

// ─── Detectors (each checks only the bytes it needs) ─────────────────────────

function isJpeg(buf: Buffer): boolean {
  // JPEG: FF D8 FF
  return (
    buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  );
}

function isPng(buf: Buffer): boolean {
  // PNG signature: 89 50 4E 47 (‰PNG)
  return (
    buf.length >= 4 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

function isWebP(buf: Buffer): boolean {
  // WebP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
  if (buf.length < 12) return false;
  const riff =
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
  const webp =
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  return riff && webp;
}

function isMp4(buf: Buffer): boolean {
  // MP4/MOV: bytes 4-7 = "ftyp" (offset 4 because bytes 0-3 are box size)
  return (
    buf.length >= 12 &&
    buf[4] === 0x66 && // f
    buf[5] === 0x74 && // t
    buf[6] === 0x79 && // y
    buf[7] === 0x70 // p
  );
}

// ─── Public validators ────────────────────────────────────────────────────────

export function validateImageFile(
  buffer: Buffer,
  reportedSizeBytes?: number,
): ValidationResult {
  const size = reportedSizeBytes ?? buffer.length;

  if (size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `حجم الصورة يتجاوز الحد المسموح (${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB)`,
    };
  }

  if (isJpeg(buffer)) return { valid: true, detectedMimeType: "image/jpeg" };
  if (isPng(buffer)) return { valid: true, detectedMimeType: "image/png" };
  if (isWebP(buffer)) return { valid: true, detectedMimeType: "image/webp" };

  return {
    valid: false,
    error:
      "نوع الملف غير مدعوم أو تم تغيير امتداده — مقبول فقط: JPEG، PNG، WebP",
  };
}

export function validateVideoFile(
  buffer: Buffer,
  reportedSizeBytes?: number,
): ValidationResult {
  const size = reportedSizeBytes ?? buffer.length;

  if (size > MAX_VIDEO_SIZE_BYTES) {
    return {
      valid: false,
      error: `حجم الفيديو يتجاوز الحد المسموح (${MAX_VIDEO_SIZE_BYTES / 1024 / 1024} MB)`,
    };
  }

  if (isMp4(buffer)) return { valid: true, detectedMimeType: "video/mp4" };

  return {
    valid: false,
    error: "نوع الملف غير مدعوم أو تم تغيير امتداده — مقبول فقط: MP4",
  };
}
