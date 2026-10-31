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
          const value = await fn(this._getClient());
          this.rotator.noteSuccess();
          return value;
        } catch (error) {
          const msg = error.message || "";
          const status = error.status || 0;

          // Rate limited → rotate key
          const is429 = status === 429 || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
          if (is429) {
            // rotate() now waits out the per-minute limit when every key is
            // cooling, so this can block for up to a minute rather than
            // failing straight through.
            if (await this.rotator.rotate()) {
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
    logger.info("Searching for latest UK–Europe removals topics via Gemini + Google Search...");

    const existingList = existingTopics.map((t) => `- ${t}`).join("\n");
    const themeList = config.topicThemes.map((t, i) => `${i + 1}. ${t}`).join("\n");

    const destinationList = config.destinations.join(", ");

    const prompt = `You are the content researcher for a UK <-> Europe removals company blog. The audience is ordinary people moving home or moving abroad — not logistics professionals. Write for someone who has never moved internationally before.

The blog must cover a BALANCED MIX of these editorial themes over time:
${themeList}

Most valuable content here is EVERGREEN, not news. A candidate topic can be:
- GUIDE: an evergreen practical guide (packing, paperwork, costs, planning, moving day)
- DESTINATION: a guide to moving to a specific city or country, e.g. "Moving to Sofia", "Moving to Budapest", "Moving to the UK". Draw from these routes the company actually serves: ${destinationList}
- SEASONAL: something tied to the time of year (winter moves, summer peak, school-year timing)
- TOPICAL: a genuine recent change that affects people moving between the UK and Europe (customs rules, ToR, border requirements). Only if there really is one — do not invent news.

RULES:
- Return EXACTLY 6 candidate topics as a JSON array.
- The candidates MUST span at least 4 DIFFERENT themes from the list above.
- AT LEAST 2 candidates must be DESTINATION guides for cities or countries not already covered below.
- Prefer questions a real customer would type into Google before a move.
- The existing articles listed below start with the most recently published — actively avoid their themes and destinations so consecutive posts feel different.
- DO NOT suggest topics that overlap with these existing blog articles:
${existingList}

Each object must have:
- "title": engaging article title (under 80 chars), phrased the way a customer would search
- "summary": 2-3 sentence summary of what the article will actually cover
- "theme": the theme from the list it belongs to (short phrase)
- "relevance": score 1-10 (how useful to someone planning a UK <-> Europe move)
- "sources": array of source names, or an empty array for evergreen guides

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

    const prompt = `Write a helpful blog article for Space 4 Time Ltd, a removals company moving households between the UK and Europe.

ABOUT SPACE 4 TIME (the only facts you may use when mentioning the company):
- Household removals between the UK and mainland Europe, in both directions
- Dedicated vans: Luton van (20 m³ / 1,000 kg) and Mega van (38 m³ / 3,000 kg) — the whole van is yours
- Shared transport (part load): you pay for the space you use, sharing the van with other moves — cheaper, slightly less flexible on dates
- Professional packing services and packing materials, plus dismantling and reassembling furniture
- Storage
- Help with customs paperwork for international moves, including Transfer of Residence (ToR) applications for moves into the UK
- Free online volume calculator to estimate how much space a move needs
- Free quotes, and the website is available in 12 languages
Do NOT claim anything beyond this list — no vehicle tracking, no insurance products, no shipping by sea or air, no office/commercial relocations.

Topic: ${topic.title}
Context: ${topic.summary}
${topic.theme ? `Theme: ${topic.theme}` : ""}
${topic.sources && topic.sources.length ? `Sources: ${topic.sources.join(", ")}` : ""}

Requirements:
- title: engaging, SEO-optimized, under 80 characters
- description: 150-200 character SEO meta description
- keywords: 5-8 relevant keywords as a JSON array of strings
- categories: one or more of ["moving-guides", "destinations", "packing", "customs", "costs", "company"]
- content: 700-1000 words in Markdown format.

  CONTENT STRUCTURE (follow this EXACTLY):

  1. Start with a ### intro line (one sentence, sets the scene — this gets drop-cap styling)
  2. First paragraph (2-3 sentences expanding on the intro)
  3. ## Section Heading
     Body paragraphs (3-4 sentences each). Bullet lists are OK inside sections.
  4. ## Another Section Heading
     More content. After the 3rd paragraph in the article, include this exact CTA on its own line:
     <!--BaseButton {"text":"Get a Free Quote","color":"#c0862a"} -->
  5. ## Conclusion
     Short closing paragraph (2-3 sentences)

  FORMATTING RULES:
  - Use ### ONLY ONCE — the very first line of content (the intro). Never use ### anywhere else.
  - Use ## for all section headings. Never use # or ####.
  - Bullet lists (using -) are allowed inside sections, but NEVER immediately after a ### line. Always put a full paragraph between ### and any list.
  - Keep paragraphs concise: 3-4 sentences max.

  TONE AND SUBSTANCE:
  - Warm, plain and practical. Write for a person, not a business. No jargon.
  - Be concrete: real numbers, real timelines, real document names. "Apply for ToR at least 3 weeks ahead" beats "apply early".
  - Acknowledge the stressful parts honestly rather than pretending a move is effortless.
  - For DESTINATION guides, cover what someone actually needs: typical costs, paperwork and residency basics, neighbourhoods or regions, how long the move takes from the UK, and one or two things people usually get wrong.
  - Never state customs or immigration rules as guaranteed — say they change and should be checked, and point to the official source where one exists (for example gov.uk for ToR).

  MENTIONING SPACE 4 TIME:
  - Weave in at most ONE brief mention inside a body section where it genuinely helps (for example choosing between a dedicated van and shared transport, or help with ToR paperwork) — one sentence, part of the advice, never salesy.
  - You may mention the company ONCE more in the conclusion.
  - Maximum 2 mentions total. Never dedicate a section to the company. Only reference capabilities from the ABOUT list — never invent services.

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
        contents: `Write a single image generation prompt for a blog hero image on a household removals website. The article is titled: "${title}". Description: "${description}". Write a detailed scene description that visually represents this specific topic — think homes, boxes, furniture, streets and everyday people mid-move, or the destination city where the article is a location guide. Warm, natural daylight, editorial photography style, never a stock-photo cliché of people grinning at the camera. Include specific objects, setting, lighting and perspective. No text, no logos, no lorries on motorways unless the article is genuinely about transport. Return ONLY the prompt text, nothing else. Max 150 words.`,
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
3. Translate naturally, not word-for-word. Warm, plain language aimed at ordinary people planning a house move — not corporate or technical.
4. Keep "Space 4 Time" and "Space 4 Time Ltd" as-is (brand name, never translate). Keep official terms that have no local equivalent as-is too, with a short translated gloss in brackets the first time: "Transfer of Residence (ToR)", "gov.uk", "Council Tax".
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
      const prompt = `Write social media posts for a UK <-> Europe household removals blog article. The audience is people planning a move, not logistics professionals. Warm and practical, never corporate.

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

    const prompt = `You are checking whether a proposed article for a UK <-> Europe removals blog would duplicate one already published. The blog deliberately publishes many articles in the same format — one guide per destination city or country, one guide per paperwork or packing question — so sharing a format, a theme or a few words with an existing article is expected and is NOT duplication.

CANDIDATE TOPIC:
Title: "${candidateTitle}"
Summary: "${candidateSummary}"

EXISTING PUBLISHED ARTICLES:
${articleList}

It IS a duplicate only if a reader who already read one existing article would learn little new from the candidate, because it answers the same question for the same place, e.g.:
- "Moving to Amsterdam from the UK" vs "Relocating to Amsterdam: a guide for Brits"
- "UK to Europe removal costs" vs "How much does a UK to Europe move cost?"

It is NOT a duplicate when:
- It is about a different destination city or country, even if the existing article uses the same format ("Moving to Prague" vs "Moving to Amsterdam", "Moving to Germany" vs "Moving to Portugal")
- It answers a different question within the same theme (choosing a removals company vs removal costs; customs inventory vs restricted items; banking and healthcare after the move vs proof of address)
- It covers a different stage of the move, a different audience, a different season, or a genuinely new rule change

Scoring: 0 = unrelated, 50 = same theme but a different question or place, 80 = same question for the same place, 100 = identical.

Return ONLY a JSON object:
{
  "isSimilar": true/false,
  "score": <0-100 as defined above>,
  "matchedTitle": "<title of the closest existing article, or null>",
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
    // The score decides, not the model's own yes/no: at the old cut-off of 60,
    // every new destination guide was rejected as a copy of an existing one
    // and runs failed with "No unique topic found".
    parsed.isSimilar = Number(parsed.score) >= 80;
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
