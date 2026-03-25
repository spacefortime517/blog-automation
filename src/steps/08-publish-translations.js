import { createArticle } from "../services/backend-api.js";
import { logger } from "../utils/logger.js";
import { sleep } from "../utils/retry.js";

/**
 * Step 8: Publish all translated articles via the admin API.
 * Uses the same article ID to link all language versions.
 * @param {object[]} translations - Array of translated articles from step 7
 * @param {string} articleId - The shared article ID from step 6
 * @param {object} englishArticle - Original English article (for categories, imgUrl fallback)
 * @param {string} imgUrl - Image URL from step 5
 * @returns {object} { published: number, skipped: number, failed: number }
 */
export async function stepPublishTranslations(
  translations,
  articleId,
  englishArticle,
  imgUrl
) {
  logger.step(
    8,
    `Publishing ${translations.length} translated articles (ID: ${articleId})...`
  );

  let published = 0;
  let skipped = 0;
  let failed = 0;

  for (const translation of translations) {
    const payload = {
      id: articleId,
      title: translation.title,
      description: translation.description,
      keywords: translation.keywords,
      content: translation.content,
      language: translation.language,
      slug: translation.slug,
      categories: englishArticle.categories,
      imgUrl: imgUrl || "",
    };

    try {
      await createArticle(payload);
      published++;
      logger.info(`  Published ${translation.language}: "${translation.title}"`);
    } catch (error) {
      if (error.status === 409) {
        skipped++;
        logger.warn(`  Skipped ${translation.language} (already exists)`);
      } else {
        failed++;
        logger.error(
          `  Failed ${translation.language}: ${error.message}`
        );
      }
    }

    // Delay between API calls to avoid SES overload from subscriber notifications
    await sleep(500);
  }

  logger.step(
    8,
    `Translations done: ${published} published, ${skipped} skipped, ${failed} failed`
  );
  return { published, skipped, failed };
}
