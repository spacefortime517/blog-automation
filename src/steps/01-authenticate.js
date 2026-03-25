import { authenticate, verifyAuth } from "../services/backend-api.js";
import { logger } from "../utils/logger.js";

/**
 * Step 1: Authenticate with the backend admin API.
 * Signs a JWT and verifies it works.
 * @returns {string[]} existing English article titles (used for dedup in step 2)
 */
export async function stepAuthenticate() {
  logger.step(1, "Authenticating with backend API...");
  authenticate();
  const articles = await verifyAuth();
  logger.step(1, `Authenticated. ${articles.length} existing English articles found.`);
  return articles;
}
