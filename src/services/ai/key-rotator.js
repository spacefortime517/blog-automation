import { logger } from "../../utils/logger.js";

/**
 * Rotates through multiple API keys on 429 (rate limit) responses.
 * Keys come from GEMINI_API_KEYS env var (comma-separated).
 */
export class KeyRotator {
  constructor(keys) {
    if (!keys || keys.length === 0) {
      throw new Error("KeyRotator requires at least one API key");
    }
    this.keys = keys;
    this.currentIndex = 0;
    this.exhaustedKeys = new Set();
    logger.info(`KeyRotator initialized with ${keys.length} key(s)`);
  }

  /** Get the current active key */
  get currentKey() {
    return this.keys[this.currentIndex];
  }

  /**
   * Rotate to the next key. Called when a 429 is received.
   * @returns {boolean} true if a fresh key is available, false if all exhausted
   */
  rotate() {
    this.exhaustedKeys.add(this.currentIndex);
    const nextIndex = (this.currentIndex + 1) % this.keys.length;

    if (this.exhaustedKeys.has(nextIndex)) {
      // Check if ALL keys are exhausted
      if (this.exhaustedKeys.size >= this.keys.length) {
        logger.error("All API keys exhausted (429 on every key)");
        return false;
      }
    }

    this.currentIndex = nextIndex;
    logger.warn(
      `Rotated to key #${this.currentIndex + 1}/${this.keys.length} after rate limit`
    );
    return true;
  }

  /** Reset exhaustion state (e.g., at the start of a new pipeline run) */
  reset() {
    this.exhaustedKeys.clear();
    this.currentIndex = 0;
  }
}
