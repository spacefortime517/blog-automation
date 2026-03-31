#!/usr/bin/env node
/**
 * One-off script to translate and publish an existing English article.
 *
 * Usage:
 *   node src/translate-one.js <slug>
 *
 * Example:
 *   node src/translate-one.js pickup2-launch-europe-freight-platform
 */
import "dotenv/config";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { getAIProvider } from "./services/ai/provider.js";
import { authenticate, verifyAuth, createArticle } from "./services/backend-api.js";
import { stepTranslate } from "./steps/07-translate.js";
import { sleep } from "./utils/retry.js";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node src/translate-one.js <slug>");
  process.exit(1);
}

async function main() {
  // Authenticate
  authenticate();
  const articles = await verifyAuth();

  // Find the English article by slug
  const article = articles.find((a) => a.slug === slug);
  if (!article) {
    console.error(`Article not found with slug: ${slug}`);
    console.error("Available slugs:", articles.map((a) => a.slug).join(", "));
    process.exit(1);
  }

  logger.info(`Found article: "${article.title}" (ID: ${article.id})`);
  logger.info(`Image URL: ${article.imgUrl ? "yes" : "none"}`);

  // Translate
  const ai = await getAIProvider();
  const translations = await stepTranslate(ai, article);

  // Publish translations
  let published = 0;
  let skipped = 0;
  let failed = 0;

  for (const translation of translations) {
    const payload = {
      id: article.id,
      title: translation.title,
      description: translation.description,
      keywords: translation.keywords,
      content: translation.content,
      language: translation.language,
      slug: translation.slug,
      categories: article.categories,
      imgUrl: article.imgUrl || "",
    };

    try {
      await createArticle(payload);
      published++;
      logger.info(`Published ${translation.language}: "${translation.title}"`);
    } catch (error) {
      if (error.status === 409) {
        skipped++;
        logger.warn(`Skipped ${translation.language} (already exists)`);
      } else {
        failed++;
        logger.error(`Failed ${translation.language}: ${error.message}`);
      }
    }

    await sleep(500);
  }

  logger.info(`\nDone: ${published} published, ${skipped} skipped, ${failed} failed`);
}

main().catch((error) => {
  logger.error(`Failed: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});
