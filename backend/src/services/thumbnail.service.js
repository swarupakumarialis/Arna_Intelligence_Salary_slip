import sharp from 'sharp';

/**
 * Employee photo thumbnail generation (Sprint 6.2D). The only place
 * in the app that ever produces the base64 stored in
 * Employee.photoDataUri — both the live upload path
 * (controllers/employee.controller.js's uploadPhoto) and the
 * migration script (scripts/generateEmployeePhotoThumbnails.js) call
 * this same function, so "how a thumbnail is made" has exactly one
 * definition.
 */

const THUMBNAIL_DIMENSION = 150;
const TARGET_MAX_BYTES = 20 * 1024; // ~20KB ceiling from the sprint spec
// Tried in order until the encoded thumbnail fits under
// TARGET_MAX_BYTES — starts within the requested 75–80 range; only
// drops further for unusually high-entropy source images.
const QUALITY_LADDER = [80, 75, 65, 55, 45];

/** Resizes/compresses an original image buffer (any format Sharp can
    read — matches the JPEG/PNG/WEBP/GIF multer already accepts) into
    a small square JPEG, returned as a ready-to-store data URI. */
export async function generateThumbnailDataUri(buffer) {
  let thumbnailBuffer = null;

  for (const quality of QUALITY_LADDER) {
    // .rotate() with no args applies the source's EXIF orientation
    // (common for phone camera photos) before the square crop below,
    // so a portrait taken sideways doesn't end up cropped wrong.
    thumbnailBuffer = await sharp(buffer)
      .rotate()
      .resize(THUMBNAIL_DIMENSION, THUMBNAIL_DIMENSION, { fit: 'cover', position: 'centre' })
      .jpeg({ quality })
      .toBuffer();

    if (thumbnailBuffer.length <= TARGET_MAX_BYTES) break;
  }

  return `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
}
