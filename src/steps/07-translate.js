import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";
import { sleep } from "../utils/retry.js";

/**
 * Step 7: Translate the English article to all other languages.
 * @param {object} ai - AIProvider instance
 * @param {object} article - English article from step 3
 * @returns {object[]} Array of translated articles with `language` field added
 */
export async function stepTranslate(ai, article) {
  logger.step(7, `Translating article to ${config.targetLanguages.length} languages...`);

  const translations = [];

  for (const lang of config.targetLanguages) {
    const langName = config.languageNames[lang];

    try {
      const translated = await withRetry(
        () => ai.translate(article, lang, langName),
        { maxRetries: 3, baseDelay: 2000, label: `translate(${lang})` }
      );

      // Fallback to English slug if translation produced empty/null slug
      if (!translated.slug) {
        translated.slug = article.slug;
      }

      // Ensure slug is URL-safe
      translated.slug = translated.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      // Slug must be unique per language (Article model has unique constraint on slug)
      // Append language code to avoid collisions
      if (!translated.slug.endsWith(`-${lang}`)) {
        translated.slug = `${translated.slug}-${lang}`;
      }

      // Ensure keywords is an array
      if (typeof translated.keywords === "string") {
        translated.keywords = translated.keywords.split(",").map((k) => k.trim());
      }

      translated.language = lang;
      translations.push(translated);
      logger.info(`  Translated to ${langName} (${lang})`);
    } catch (error) {
      logger.error(`  Failed to translate to ${langName} (${lang}): ${error.message}`);
      // Continue with other languages
    }

    // Small delay to respect rate limits (15 RPM for Flash-Lite)
    await sleep(500);
  }

  logger.step(7, `Translated to ${translations.length}/${config.targetLanguages.length} languages`);
  return translations;
}
