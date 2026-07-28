import { logger } from "../../utils/logger.js";
import { sleep } from "../../utils/retry.js";

// Gemini's free-tier 429 is a requests-per-minute limit, not a wall for the
// day: the key works again about a minute later. A little padding on top of
// the minute avoids waking up one request too early and burning the retry.
const COOLDOWN_MS = 65_000;

// If every key is still cooling after this long, something other than the
// per-minute limit is wrong — a daily quota, a revoked key — and waiting will
// not fix it. Give up rather than sit out the job's 30-minute budget.
const MAX_WAIT_MS = 5 * 60_000;

/**
 * Rotates through multiple API keys on 429 (rate limit) responses.
 * Keys come from GEMINI_API_KEYS env var (comma-separated).
 *
 * Keys are put on a cooldown rather than written off. An earlier version kept
 * a Set of "exhausted" keys that was never cleared during a run, so a single
 * 429 killed a key for good: with two keys, one busy minute during article
 * generation left the rest of the run — the hero image and all eleven
 * translations — failing instantly against keys that were already working
 * again. That run still exited 0 and published an English-only article with
 * no image.
 */
export class KeyRotator {
  constructor(keys) {
    if (!keys || keys.length === 0) {
      throw new Error("KeyRotator requires at least one API key");
    }
    this.keys = keys;
    this.currentIndex = 0;
    // index -> epoch ms before which the key should not be used
    this.cooldownUntil = new Map();
    // How long this run has spent waiting on limits since the last successful
    // call. A per-minute limit clears; a spent daily quota never does, and
    // without this the pipeline would rotate-and-wait until the job timed out.
    this.waitedMs = 0;
    logger.info(`KeyRotator initialized with ${keys.length} key(s)`);
  }

  /** Get the current active key */
  get currentKey() {
    return this.keys[this.currentIndex];
  }

  _availableFrom(index) {
    return this.cooldownUntil.get(index) ?? 0;
  }

  /** Called after a successful API call — the limits have clearly cleared. */
  noteSuccess() {
    this.waitedMs = 0;
  }

  /**
   * Called when the current key returns a 429. Puts it on cooldown and moves
   * to one that isn't; if they are all cooling, waits for the first to come
   * back rather than failing the call.
   *
   * @returns {Promise<boolean>} true if a usable key is now selected
   */
  async rotate() {
    this.cooldownUntil.set(this.currentIndex, Date.now() + COOLDOWN_MS);

    const now = Date.now();
    const free = this.keys.findIndex((_, i) => this._availableFrom(i) <= now);
    if (free !== -1) {
      this.currentIndex = free;
      logger.warn(
        `Rotated to key #${free + 1}/${this.keys.length} after rate limit`
      );
      return true;
    }

    // Every key is cooling. Wait for whichever frees up first.
    const earliest = Math.min(...this.keys.map((_, i) => this._availableFrom(i)));
    const waitMs = earliest - Date.now();

    if (this.waitedMs + Math.max(waitMs, 0) > MAX_WAIT_MS) {
      logger.error(
        `All ${this.keys.length} API keys have been rate limited for over ` +
          `${Math.round(MAX_WAIT_MS / 1000)}s — this is not the per-minute ` +
          `limit, so waiting longer will not help. Giving up.`
      );
      return false;
    }

    if (waitMs > 0) {
      this.waitedMs += waitMs;
      logger.warn(
        `All ${this.keys.length} keys rate limited — waiting ${Math.ceil(waitMs / 1000)}s for the limit to reset`
      );
      await sleep(waitMs);
    }

    this.currentIndex = this.keys.findIndex(
      (_, i) => this._availableFrom(i) <= Date.now()
    );
    if (this.currentIndex === -1) this.currentIndex = 0;
    return true;
  }

  /** Reset cooldown state (e.g., at the start of a new pipeline run) */
  reset() {
    this.cooldownUntil.clear();
    this.waitedMs = 0;
    this.currentIndex = 0;
  }
}
