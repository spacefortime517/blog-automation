import { getNextId, createArticle } from "../services/backend-api.js";
import { logger } from "../utils/logger.js";

/**
 * Step 6: Publish the English article via the admin API.
 * @param {object} article - Article from step 3
 * @param {string} imgUrl - Image URL from step 5
 * @returns {object} { articleId, createdData }
 */
export async function stepPublishEnglish(article, imgUrl) {
  logger.step(6, "Publishing English article...");

  const articleId = await getNextId();

  const payload = {
    id: articleId,
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    content: article.content,
    language: "en",
    slug: article.slug,
    categories: article.categories,
    imgUrl: imgUrl || "",
  };

  try {
    const result = await createArticle(payload);
    logger.step(6, `English article published: ${articleId} (slug: ${article.slug})`);
    return { articleId, createdData: result.createdData || result };
  } catch (error) {
    if (error.status === 409) {
      logger.warn(`Article ${articleId} already exists in English, skipping.`);
      return { articleId, createdData: null, skipped: true };
    }
    throw error;
  }
}
