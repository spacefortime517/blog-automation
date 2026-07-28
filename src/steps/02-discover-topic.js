import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

const MAX_DISCOVERY_ATTEMPTS = 3;

/**
 * Step 2: Discover a fresh UK–Europe removals topic.
 * Uses AI with web grounding to find news not already on the blog.
 * Validates each candidate against existing articles for semantic similarity.
 * @param {object} ai - AIProvider instance
 * @param {object[]} existingArticles - Array of existing articles from step 1
 * @returns {object} Selected topic { title, summary, relevance, sources }
 */
export async function stepDiscoverTopic(ai, existingArticles) {
  logger.step(2, "Discovering a removals topic...");

  const existingTopics = existingArticles.map(
    (a) => `${a.title} — ${a.description || ""}`
  );

  for (let attempt = 1; attempt <= MAX_DISCOVERY_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      logger.step(2, `Discovery attempt ${attempt}/${MAX_DISCOVERY_ATTEMPTS}...`);
    }

    const candidates = await withRetry(
      () => ai.searchNews(existingTopics),
      { maxRetries: 3, label: "discoverTopic" }
    );

    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new Error("No topic candidates returned from AI search");
    }

    // Sort by relevance descending
    candidates.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    // Check each candidate for similarity against existing articles
    for (const candidate of candidates) {
      logger.step(
        2,
        `Checking candidate (relevance ${candidate.relevance}/10, theme: ${candidate.theme || "n/a"}): "${candidate.title}"`
      );

      const similarity = await ai.checkTopicSimilarity(
        candidate.title,
        candidate.summary,
        existingArticles
      );

      if (similarity.isSimilar) {
        logger.warn(
          `Rejected "${candidate.title}" — too similar (score: ${similarity.score}/100) to: "${similarity.matchedTitle}". Reason: ${similarity.reason}`
        );
        continue;
      }

      logger.step(
        2,
        `Selected topic (relevance ${candidate.relevance}/10, theme: ${candidate.theme || "n/a"}, similarity ${similarity.score}/100): "${candidate.title}"`
      );
      return candidate;
    }

    logger.warn(`All ${candidates.length} candidates were too similar to existing articles.`);
  }

  throw new Error(
    `No unique topic found after ${MAX_DISCOVERY_ATTEMPTS} discovery attempts. All candidates were too similar to existing articles.`
  );
}
