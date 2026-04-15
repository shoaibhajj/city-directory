import sharp from "sharp";

const MAX_DIMENSION = 1920;
const WEBP_QUALITY_FULL = 82;
const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 300;
const WEBP_QUALITY_THUMB = 70;

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Full image processing pipeline:
 *
 * 1. .rotate()  — reads EXIF orientation, physically rotates pixels, then
 *                 strips ALL EXIF metadata (GPS, device model, timestamps).
 *                 WHY: EXIF GPS leaks the photographer's location. .rotate()
 *                 is the Sharp-idiomatic way to fix orientation AND strip EXIF.
 * 2. .resize()  — shrinks to max 1920px on longest edge. 'inside' + no-enlarge
 *                 means small images are never blown up.
 * 3. .webp()    — converts to WebP at quality 82. ~30% smaller than JPEG
 *                 at equivalent visual quality.
 */
export async function processImage(
  inputBuffer: Buffer,
): Promise<ProcessedImage> {
  const { data, info } = await sharp(inputBuffer, { failOnError: false })
    .rotate()
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY_FULL })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    sizeBytes: info.size,
  };
}

/**
 * Generates a fixed 400×300 thumbnail for gallery previews.
 * 'cover' fit = smart crop to fill the box exactly.
 * sharp.strategy.entropy = crop to the most visually interesting region.
 */
export async function generateThumbnail(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer, { failOnError: false })
    .rotate()
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: "cover",
      position: sharp.strategy.entropy,
    })
    .webp({ quality: WEBP_QUALITY_THUMB })
    .toBuffer();
}
