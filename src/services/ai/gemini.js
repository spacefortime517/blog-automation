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
   * Call Gemini with automatic key rotation on 429.
   * @param {Function} fn - Receives (client) and should return the API result
   */
  async _callWithRotation(fn) {
    const maxAttempts = this.rotator.keys.length + 1;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await fn(this._getClient());
      } catch (error) {
        const is429 =
          error.status === 429 ||
          error.message?.includes("429") ||
          error.message?.includes("RESOURCE_EXHAUSTED");
        if (is429 && this.rotator.rotate()) {
          logger.warn("Rate limited, switched to next API key");
          await sleep(2000);
          continue;
        }
        throw error;
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
- content: 800-1200 words in Markdown format
  - Use ## for subheadings (not #)
  - After the 3rd paragraph, include this exact CTA on its own line:
    <!--BaseButton {"text":"Try Pickup2 Free","color":"#007bff"} -->
  - End with a conclusion paragraph
  - Professional, informative tone
  - Reference how the Pickup2 platform helps where relevant (subtly, not salesy)
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

    const prompt = `Write social media posts for a logistics industry blog article.

Article title: "${title}"
Description: "${description}"
URL: ${url}

Generate posts for 3 platforms. Return ONLY a JSON object:
{
  "twitter": "tweet text max 260 chars (leave room for URL). Include 3-4 hashtags like #EULogistics #FreightTech",
  "facebook": "Facebook post 2-3 sentences. Professional tone. Include the URL. Add relevant hashtags.",
  "linkedin": "LinkedIn post 3-4 sentences. Professional/industry tone. Include the URL. Add relevant hashtags."
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
