import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

/**
 * Step 4: Generate a hero image for the blog article.
 * @param {object} ai - AIProvider instance
 * @param {string} title - Article title
 * @param {string} description - Article description
 * @returns {Buffer} Image buffer (PNG)
 */
export async function stepGenerateImage(ai, title, description) {
  logger.step(4, "Generating hero image...");

  try {
    const imageBuffer = await withRetry(
      () => ai.generateImage(title, description),
      { maxRetries: 2, label: "generateImage" }
    );

    logger.step(4, `Hero image generated (${(imageBuffer.length / 1024).toFixed(0)} KB)`);
    return imageBuffer;
  } catch (error) {
    logger.warn(`Image generation failed: ${error.message}. Continuing without image.`);
    return null;
  }
}
