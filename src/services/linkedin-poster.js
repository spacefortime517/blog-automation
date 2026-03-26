import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = join(__dirname, "../../.linkedin-tokens.json");
const LINKEDIN_VERSION = "202602";

/**
 * Load tokens from file (refreshed tokens) or fall back to env vars.
 */
function loadTokens() {
  try {
    const data = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
    return {
      accessToken: data.access_token || config.linkedin.accessToken,
      refreshToken: data.refresh_token || config.linkedin.refreshToken,
    };
  } catch {
    return {
      accessToken: config.linkedin.accessToken,
      refreshToken: config.linkedin.refreshToken,
    };
  }
}

/**
 * Save refreshed tokens to file so they persist across runs.
 */
function saveTokens(accessToken, refreshToken) {
  writeFileSync(
    TOKEN_FILE,
    JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }, null, 2)
  );
}

/**
 * Refresh the LinkedIn access token using the refresh token.
 */
async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = config.linkedin;

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`LinkedIn token refresh failed: ${data.error_description || JSON.stringify(data)}`);
  }

  logger.info("LinkedIn access token refreshed successfully");
  saveTokens(data.access_token, data.refresh_token || refreshToken);
  return data.access_token;
}

/**
 * Make a LinkedIn API request with automatic token refresh on 401.
 */
async function linkedinRequest(url, options, tokens) {
  const makeRequest = (token) =>
    fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": LINKEDIN_VERSION,
        "Content-Type": "application/json",
      },
    });

  let res = await makeRequest(tokens.accessToken);

  // If unauthorized, try refreshing the token
  if (res.status === 401 && tokens.refreshToken) {
    logger.info("LinkedIn access token expired, refreshing...");
    tokens.accessToken = await refreshAccessToken(tokens.refreshToken);
    res = await makeRequest(tokens.accessToken);
  }

  return res;
}

/**
 * Post to LinkedIn using the Posts API.
 * @param {string} text - Post commentary text
 * @param {string} [articleUrl] - Optional article URL for rich link preview
 * @param {object} [articleMeta] - Optional article metadata { title, description }
 * @returns {string|null} Post URN, or null if not configured
 */
export async function postToLinkedIn(text, articleUrl, articleMeta) {
  const { orgId, clientId, accessToken } = config.linkedin;

  if (!clientId || !accessToken) {
    logger.warn("LinkedIn API not configured, skipping");
    return null;
  }

  logger.info("Posting to LinkedIn via API...");

  const tokens = loadTokens();
  const author = orgId
    ? `urn:li:organization:${orgId}`
    : `urn:li:person:${config.linkedin.personId}`;

  const body = {
    author,
    commentary: text,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  // Add article content for rich link preview
  if (articleUrl) {
    body.content = {
      article: {
        source: articleUrl,
        title: articleMeta?.title || "",
        description: articleMeta?.description || "",
      },
    };
  }

  const res = await linkedinRequest(
    "https://api.linkedin.com/rest/posts",
    { method: "POST", body: JSON.stringify(body) },
    tokens
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errMsg = errorData.message || JSON.stringify(errorData);
    throw new Error(`LinkedIn API error (${res.status}): ${errMsg}`);
  }

  const postId = res.headers.get("x-restli-id");
  logger.info(`Posted to LinkedIn: ${postId}`);
  return postId;
}
