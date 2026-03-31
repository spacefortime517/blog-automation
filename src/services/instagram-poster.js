import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Wait for an Instagram media container to finish processing.
 * @param {string} containerId - Container ID from /media endpoint
 * @param {string} accessToken - Access token
 * @param {number} maxAttempts - Max polling attempts
 * @returns {string} Final status code
 */
async function waitForContainer(containerId, accessToken, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${GRAPH_API}/${containerId}?fields=status_code,status&access_token=${accessToken}`
    );
    const data = await res.json();

    if (data.status_code === "FINISHED") return data.status_code;
    if (data.status_code === "ERROR") {
      throw new Error(`Instagram container error: ${data.status}`);
    }

    // Wait 2 seconds before next poll
    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error("Instagram container processing timed out");
}

/**
 * Post an image to Instagram using the Content Publishing API.
 * @param {string} caption - Post caption text
 * @param {string} imageUrl - Publicly accessible image URL
 * @returns {string|null} Media ID, or null if not configured
 */
export async function postToInstagram(caption, imageUrl) {
  const { userId, accessToken } = config.instagram;

  if (!userId || !accessToken) {
    logger.warn("Instagram not configured (INSTAGRAM_USER_ID / INSTAGRAM_ACCESS_TOKEN missing), skipping");
    return null;
  }

  if (!imageUrl) {
    logger.warn("Instagram requires an image URL, skipping (no image available)");
    return null;
  }

  logger.info("Posting to Instagram...");

  // Step 1: Create media container
  const containerRes = await fetch(`${GRAPH_API}/${userId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }),
  });

  const containerData = await containerRes.json();

  if (!containerRes.ok) {
    const errMsg = containerData.error?.message || JSON.stringify(containerData);
    throw new Error(`Instagram container creation failed: ${errMsg}`);
  }

  const containerId = containerData.id;
  logger.info(`Instagram container created: ${containerId}`);

  // Step 2: Wait for processing
  await waitForContainer(containerId, accessToken);

  // Step 3: Publish
  const publishRes = await fetch(`${GRAPH_API}/${userId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });

  const publishData = await publishRes.json();

  if (!publishRes.ok) {
    const errMsg = publishData.error?.message || JSON.stringify(publishData);
    throw new Error(`Instagram publish failed: ${errMsg}`);
  }

  logger.info(`Posted to Instagram: media ID ${publishData.id}`);
  return publishData.id;
}
