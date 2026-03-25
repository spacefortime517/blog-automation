import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Post to a Facebook Page using the Meta Pages API.
 * @param {string} message - Post text (with URL and hashtags)
 * @param {string} link - Article URL
 * @returns {string|null} Post ID, or null if not configured
 */
export async function postToFacebook(message, link) {
  const { pageId, pageAccessToken } = config.facebook;

  if (!pageId || !pageAccessToken) {
    logger.warn("Facebook not configured (FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN missing), skipping");
    return null;
  }

  logger.info("Posting to Facebook Page...");

  const url = `https://graph.facebook.com/v22.0/${pageId}/feed`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      link,
      access_token: pageAccessToken,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data.error?.message || JSON.stringify(data);
    throw new Error(`Facebook API error: ${errMsg}`);
  }

  logger.info(`Posted to Facebook: post ID ${data.id}`);
  return data.id;
}
