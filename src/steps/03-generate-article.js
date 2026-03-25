import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";
import { checkSlugExists } from "../services/backend-api.js";

/**
 * Step 3: Generate a full English blog article from the selected topic.
 * @param {object} ai - AIProvider instance
 * @param {object} topic - Selected topic from step 2
 * @returns {object} Article { title, description, keywords, categories, content, slug }
 */
export async function stepGenerateArticle(ai, topic) {
  logger.step(3, "Generating English blog article...");

  const article = await withRetry(
    () => ai.generateArticle(topic),
    { maxRetries: 3, label: "generateArticle" }
  );

  // Validate required fields (slug is auto-generated if missing)
  const required = ["title", "description", "keywords", "categories", "content"];
  for (const field of required) {
    if (!article[field]) {
      throw new Error(`Generated article missing required field: ${field}`);
    }
  }

  // Generate slug from title if AI didn't provide one
  if (!article.slug) {
    article.slug = article.title;
    logger.warn("AI did not return a slug, generating from title");
  }

  // Ensure slug is URL-safe
  article.slug = article.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Check for slug collision
  const slugExists = await checkSlugExists(article.slug);
  if (slugExists) {
    // Append date to make it unique
    const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    article.slug = `${article.slug}-${dateSuffix}`;
    logger.warn(`Slug collision, using: ${article.slug}`);
  }

  const wordCount = article.content.split(/\s+/).length;
  logger.step(
    3,
    `Article generated: "${article.title}" (${wordCount} words, slug: ${article.slug})`
  );

  return article;
}
