import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

/**
 * Step 2: Discover a fresh EU logistics news topic.
 * Uses AI with web grounding to find news not already on the blog.
 * @param {object} ai - AIProvider instance
 * @param {object[]} existingArticles - Array of existing articles from step 1
 * @returns {object} Selected topic { title, summary, relevance, sources }
 */
export async function stepDiscoverTopic(ai, existingArticles) {
  logger.step(2, "Discovering latest EU logistics news topic...");

  const existingTopics = existingArticles.map(
    (a) => `${a.title} — ${a.description || ""}`
  );

  const candidates = await withRetry(
    () => ai.searchNews(existingTopics),
    { maxRetries: 3, label: "discoverTopic" }
  );

  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("No topic candidates returned from AI search");
  }

  // Sort by relevance descending, pick the best one
  candidates.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  const selected = candidates[0];

  logger.step(
    2,
    `Selected topic (relevance ${selected.relevance}/10): "${selected.title}"`
  );
  return selected;
}
