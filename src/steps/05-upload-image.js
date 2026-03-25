import { uploadImage } from "../services/backend-api.js";
import { logger } from "../utils/logger.js";

/**
 * Step 5: Upload the hero image to the backend (S3).
 * @param {Buffer|null} imageBuffer - Image buffer from step 4, or null if generation failed
 * @param {string} slug - Article slug (used for filename)
 * @returns {string} Image URL, or empty string if no image
 */
export async function stepUploadImage(imageBuffer, slug) {
  if (!imageBuffer) {
    logger.step(5, "No image to upload, skipping.");
    return "";
  }

  logger.step(5, "Uploading hero image to backend...");
  const filename = `${slug}-hero.png`;
  const imgUrl = await uploadImage(imageBuffer, filename);
  logger.step(5, `Image uploaded successfully`);
  return imgUrl;
}
