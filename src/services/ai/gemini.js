import { GoogleGenAI } from "@google/genai";
import { AIProvider } from "./provider.js";
import { KeyRotator } from "./key-rotator.js";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { sleep } from "../../utils/retry.js";

export class GeminiProvider extends AIProvider {
  constructor() {
    super();
    this.rotator = new KeyRotator(config.geminiApiKeys);
  }

  /** Get a fresh GenAI client using the current key */
  _getClient() {
    return new GoogleGenAI({ apiKey: this.rotator.currentKey });
  }

  /**
   * Call Gemini with automatic key rotation on 429 and retry on transient errors (500/502/503).
   * @param {Function} fn - Receives (client) and should return the API result
   */
  async _callWithRotation(fn) {
    const maxKeyAttempts = this.rotator.keys.length + 1;
    const maxTransientRetries = 3;

    for (let keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
      for (let retry = 0; retry < maxTransientRetries; retry++) {
        try {
          return await fn(this._getClient());
        } catch (error) {
          const msg = error.message || "";
          const status = error.status || 0;

          // Rate limited → rotate key
          const is429 = status === 429 || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
          if (is429) {
            if (this.rotator.rotate()) {
              logger.warn("Rate limited, switched to next API key");
              await sleep(2000);
            }
            break; // break retry loop, continue key loop
          }

          // Transient server error → retry with backoff
          const isTransient =
            status === 503 || status === 500 || status === 502 ||
            msg.includes("503") || msg.includes("UNAVAILABLE") ||
            msg.includes("500") || msg.includes("502") ||
            msg.includes("overloaded") || msg.includes("high demand");

          if (isTransient && retry < maxTransientRetries - 1) {
            const delay = Math.min(5000 * Math.pow(2, retry), 30000);
            logger.warn(`Transient error (attempt ${retry + 1}/${maxTransientRetries}): ${msg.substring(0, 120)}. Retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }

          throw error;
        }
      }
    }
    throw new Error("All Gemini API keys exhausted");
  }

  async searchNews(existingTopics) {
    logger.info("Searching for latest EU logistics news via Gemini + Google Search...");

    const existingList = existingTopics.map((t) => `- ${t}`).join("\n");

    const prompt = `You are a logistics industry news researcher. Search for the latest EU news relevant to the European logistics, freight transport, and supply chain industry from the past 7 days.

Focus on: EU regulations affecting trucking/freight, cross-border transport changes, digital freight platforms, sustainability in logistics, driver shortages, toll systems, customs changes, road transport policy, freight exchange trends.

DO NOT suggest topics that overlap with these existing blog articles:
${existingList}

Return EXACTLY 3 candidate topics as a JSON array. Each object must have:
- "title": engaging article title (under 80 chars)
- "summary": 2-3 sentence summary of the news
- "relevance": score 1-10 (how relevant to logistics companies)
- "sources": array of source names

Respond with ONLY the JSON array, no markdown fences, no explanation.`;

    const result = await this._callWithRotation(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      return response.text;
    });

    return this._parseJSON(result);
  }

  async generateArticle(topic) {
    logger.info(`Generating English article for: ${topic.title}`);

    const prompt = `Write a professional blog article for Pickup2, a digital freight exchange platform for European logistics.

Topic: ${topic.title}
Context: ${topic.summary}
${topic.sources ? `Sources: ${topic.sources.join(", ")}` : ""}

Requirements:
- title: engaging, SEO-optimized, under 80 characters
- description: 150-200 character SEO meta description
- keywords: 5-8 relevant keywords as a JSON array of strings
- categories: one or more of ["shippers", "forwarders", "carriers", "managers", "general"]
- content: 500-700 words MAXIMUM in Markdown format. STRICT limit — do NOT exceed 700 words.

  CONTENT STRUCTURE (follow this EXACTLY):

  1. Start with a ### intro line (one sentence, sets the scene — this gets drop-cap styling)
  2. First paragraph (2-3 sentences expanding on the intro)
  3. ## Section Heading
     Body paragraphs (3-4 sentences each). Bullet lists are OK inside sections.
  4. ## Another Section Heading
     More content. After the 3rd paragraph in the article, include this exact CTA on its own line:
     <!--BaseButton {"text":"Try Pickup2 Free","color":"#007bff"} -->
  5. ## Conclusion
     Short closing paragraph (2-3 sentences)

  FORMATTING RULES:
  - Use ### ONLY ONCE — the very first line of content (the intro). Never use ### anywhere else.
  - Use ## for all section headings. Never use # or ####.
  - Bullet lists (using -) are allowed inside sections, but NEVER immediately after a ### line. Always put a full paragraph between ### and any list.
  - Keep paragraphs concise: 3-4 sentences max.
  - Professional, informative tone focused on the NEWS.
  - You may mention Pickup2 ONCE in the conclusion (e.g., "platforms like Pickup2 help logistics companies adapt"). Do NOT dedicate a section to Pickup2.

- slug: URL-friendly slug (lowercase, hyphens, no special chars, no trailing hyphens)

Return ONLY a JSON object with these fields: { "title", "description", "keywords", "categories", "content", "slug" }
No markdown fences. No explanation. Just the JSON.`;

    const result = await this._callWithRotation(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      return response.text;
    });

    const article = this._parseJSON(result);

    // Validate categories
    article.categories = article.categories.filter((c) =>
      config.categories.includes(c)
    );
    if (article.categories.length === 0) {
      article.categories = ["general"];
    }

    // Ensure keywords is an array
    if (typeof article.keywords === "string") {
      article.keywords = article.keywords.split(",").map((k) => k.trim());
    }

    return article;
  }

  async generateImage(title, description) {
    logger.info("Generating hero image via MiniMax Image-01...");

    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      throw new Error("MINIMAX_API_KEY not set in .env");
    }

    // Use Gemini to generate a specific image prompt from the article title
    const scenePrompt = await this._callWithRotation(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `Write a single image generation prompt for a blog hero image. The blog article is titled: "${title}". Description: "${description}". Write a detailed scene description that visually represents the specific topic. Use professional stock photo style. Include specific objects, setting, lighting, and perspective. No text in the image. Return ONLY the prompt text, nothing else. Max 150 words.`,
      });
      return response.text.trim();
    });
    logger.info(`Image scene prompt: ${scenePrompt.substring(0, 100)}...`);
    const prompt = scenePrompt;

    const response = await fetch("https://api.minimax.io/v1/image_generation", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "image-01",
        prompt,
        aspect_ratio: "16:9",
        response_format: "base64",
      }),
    });

    const data = await response.json();

    if (data.base_resp?.status_code !== 0 || !data.data?.image_base64?.length) {
      const msg = data.base_resp?.status_msg || JSON.stringify(data).substring(0, 200);
      throw new Error(`MiniMax image generation failed: ${msg}`);
    }

    const imageBuffer = Buffer.from(data.data.image_base64[0], "base64");
    logger.info(`Image generated via MiniMax (${(imageBuffer.length / 1024).toFixed(0)} KB)`);
    return imageBuffer;
  }

  async translate(article, targetLang, targetLangName) {
    logger.info(`Translating article to ${targetLangName} (${targetLang})...`);

    const prompt = `Translate the following blog article from English to ${targetLangName} (${targetLang}).

CRITICAL RULES:
1. Preserve ALL markdown formatting exactly (##, **, -, etc.)
2. Preserve ALL HTML comments exactly as-is, especially <!--BaseButton ... --> tags — do NOT translate or modify them
3. Translate naturally, not word-for-word. Use professional tone appropriate for ${targetLangName} logistics industry readers.
4. Keep "Pickup2" as-is (brand name, never translate)
5. For the slug: transliterate to ASCII-safe characters (lowercase, hyphens only, no special chars)

English article:
Title: ${article.title}
Description: ${article.description}
Keywords: ${JSON.stringify(article.keywords)}
Content:
${article.content}
Slug: ${article.slug}

Return ONLY a JSON object: { "title", "description", "keywords", "content", "slug" }
No markdown fences. No explanation. Just the JSON.`;

    const result = await this._callWithRotation(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
      });
      return response.text;
    });

    return this._parseJSON(result);
  }

  async generateSocialPost(title, description, url) {
    logger.info("Generating social media post text...");

    try {
      const prompt = `Write social media posts for a logistics industry blog article.

Article title: "${title}"
Description: "${description}"
URL: ${url}

Generate platform-optimized posts. Return ONLY a JSON object:
{
  "twitter": "Short, punchy tweet. MAX 90 characters (excluding URL — URL will be appended separately). Include 1-2 hashtags only (e.g. #EULogistics). No links in the text.",
  "facebook": "Facebook post: 2-3 sentences. Conversational professional tone. Start with a compelling question or statistic. Include the URL. 1-2 hashtags max.",
  "linkedin": "LinkedIn post: 3-5 sentences. Thought-leadership tone for logistics professionals. Open with a strong hook (insight, stat, or question). Do NOT include the article URL in the text (it will be attached as a rich card). End with 3 hashtags: 2 broad (#Logistics #SupplyChain) + 1 niche.",
  "instagram": "Instagram caption: 2-3 sentences. Engaging, visual tone. Open with a hook. Include the URL at the end. End with 5-8 relevant hashtags (mix of broad like #Logistics #SupplyChain and niche). Use line breaks between text and hashtags."
}

No markdown fences. No explanation. Just the JSON.`;

      const result = await this._callWithRotation(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: prompt,
        });
        return response.text;
      });

      return this._parseJSON(result);
    } catch (error) {
      logger.warn(`Gemini social post generation failed: ${error.message}. Using template fallback.`);
      return this._fallbackSocialPost(title, description, url);
    }
  }

  /** Template-based fallback when AI is unavailable for social post generation */
  _fallbackSocialPost(title, description, url) {
    const shortDesc = description.length > 100 ? description.substring(0, 97) + "..." : description;
    return {
      twitter: `${title} #EULogistics #SupplyChain`,
      facebook: `${title}\n\n${shortDesc}\n\nRead more: ${url}\n\n#Logistics #EUTransport`,
      linkedin: `${title}\n\n${description}\n\nStay informed on the latest developments shaping European logistics.\n\n#Logistics #SupplyChain #EUTransport`,
      instagram: `${title}\n\n${shortDesc}\n\nRead more: ${url}\n\n#Logistics #SupplyChain #EUTransport #FreightForwarding #TruckingIndustry`,
    };
  }

  async checkTopicSimilarity(candidateTitle, candidateSummary, existingArticles) {
    const recentArticles = existingArticles.slice(0, 50);
    const articleList = recentArticles
      .map((a, i) => `${i + 1}. "${a.title}" — ${a.description || ""}`)
      .join("\n");

    const prompt = `You are a duplicate content detector. Compare this candidate blog topic against existing published articles and determine if it covers the SAME or VERY SIMILAR news/subject.

CANDIDATE TOPIC:
Title: "${candidateTitle}"
Summary: "${candidateSummary}"

EXISTING PUBLISHED ARTICLES:
${articleList}

A topic is "too similar" if:
- It covers the same specific news event or announcement
- It would substantially repeat information already in an existing article
- A reader would feel they're reading the same story again

A topic is NOT too similar if:
- It covers the same broad category (e.g. both about EU logistics) but different specific events
- It provides a genuinely new angle or update on a developing story with significant new information

Return ONLY a JSON object:
{
  "isSimilar": true/false,
  "score": <0-100 similarity score, 0=completely different, 100=identical topic>,
  "matchedTitle": "<title of the most similar existing article, or null>",
  "reason": "<brief explanation>"
}

No markdown fences. No explanation outside the JSON.`;

    const result = await this._callWithRotation(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
      });
      return response.text;
    });

    const parsed = this._parseJSON(result);
    // Treat score >= 60 as too similar
    if (parsed.score >= 60) {
      parsed.isSimilar = true;
    }
    return parsed;
  }

  /** Parse JSON from LLM response, stripping markdown fences if present */
  _parseJSON(text) {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      logger.error(
        "Failed to parse AI response as JSON:",
        cleaned.substring(0, 200)
      );
      throw new Error(`AI returned invalid JSON: ${e.message}`);
    }
  }
}
