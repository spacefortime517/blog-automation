import { logger } from "./logger.js";

/**
 * Retry a function with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {object} opts
 * @param {number} opts.maxRetries - Max attempts (default 3)
 * @param {number} opts.baseDelay - Initial delay in ms (default 1000)
 * @param {number} opts.maxDelay - Max delay in ms (default 30000)
 * @param {string} opts.label - Label for logging
 */
export async function withRetry(
  fn,
  { maxRetries = 3, baseDelay = 1000, maxDelay = 30000, label = "operation" } = {}
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error(`${label} failed after ${maxRetries} attempts: ${error.message}`);
        throw error;
      }
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      logger.warn(
        `${label} attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
