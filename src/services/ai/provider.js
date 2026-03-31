import { config } from "../../config.js";

/**
 * Abstract AI provider interface.
 * All pipeline steps call these methods — never a specific AI SDK directly.
 */
class AIProvider {
  /** Search for latest EU news topics, excluding existingTopics. Returns topic candidates. */
  async searchNews(existingTopics) {
    throw new Error("searchNews() not implemented");
  }

  /** Generate a full English blog article from a topic. Returns { title, description, keywords, categories, content, slug } */
  async generateArticle(topic) {
    throw new Error("generateArticle() not implemented");
  }

  /** Generate a hero image for the article. Returns image Buffer (PNG/JPEG). */
  async generateImage(title, description) {
    throw new Error("generateImage() not implemented");
  }

  /** Translate an article to targetLang. Returns { title, description, keywords, content, slug } */
  async translate(article, targetLang, targetLangName) {
    throw new Error("translate() not implemented");
  }

  /** Generate social media post text. Returns { text, hashtags } */
  async generateSocialPost(title, description, url) {
    throw new Error("generateSocialPost() not implemented");
  }

  /** Check if a candidate topic is too similar to existing articles. Returns { isSimilar, score, matchedTitle, reason } */
  async checkTopicSimilarity(candidateTitle, candidateSummary, existingArticles) {
    throw new Error("checkTopicSimilarity() not implemented");
  }
}

/**
 * Get the configured AI provider instance.
 */
export async function getAIProvider() {
  const provider = config.aiProvider;

  if (provider === "gemini") {
    const { GeminiProvider } = await import("./gemini.js");
    return new GeminiProvider();
  }

  throw new Error(`Unknown AI provider: ${provider}. Supported: gemini`);
}

export { AIProvider };
