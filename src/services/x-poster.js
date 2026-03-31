import { chromium } from "playwright";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Post a tweet to X/Twitter using Playwright with cookie injection.
 * @param {string} text - Tweet text
 * @returns {string|null} Tweet ID or "posted"
 */
export async function postToX(text) {
  const { authToken, ct0, kdt, twid } = config.x;

  if (!authToken || !ct0) {
    logger.warn("X/Twitter cookies not configured, skipping X post");
    return null;
  }

  logger.info("Posting to X/Twitter...");

  const browser = await chromium.launch({
    headless: !process.env.DISPLAY,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
      delete window.__playwright;
      delete window.__pw_manual;
    });

    await context.addCookies([
      { name: "auth_token", value: authToken, domain: ".x.com", path: "/", httpOnly: true, secure: true, sameSite: "None" },
      { name: "ct0", value: ct0, domain: ".x.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" },
      { name: "kdt", value: kdt || "", domain: ".x.com", path: "/", httpOnly: true, secure: true, sameSite: "None" },
      { name: "twid", value: twid || "", domain: ".x.com", path: "/", httpOnly: true, secure: true, sameSite: "None" },
      { name: "lang", value: "en", domain: "x.com", path: "/", httpOnly: false, secure: false, sameSite: "Lax" },
    ]);

    const page = await context.newPage();

    // Capture API response
    let result = null;
    page.on("response", async (res) => {
      if (res.url().includes("CreateTweet")) {
        try { result = await res.json(); } catch {}
      }
    });

    await page.goto("https://x.com/compose/post", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(4000);

    if (page.url().includes("/login") || page.url().includes("/i/flow")) {
      throw new Error("X cookies expired. Update .env with fresh cookies.");
    }

    // Dismiss cookie banner if present
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, [role="button"]')];
      const reject = btns.find(b => b.textContent?.includes("Refuse non-essential"));
      if (reject) reject.click();
    });
    await page.waitForTimeout(1000);

    // Click into the tweet textarea using JavaScript
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="tweetTextarea_0"]');
      if (el) {
        el.focus();
        el.click();
      }
    });
    await page.waitForTimeout(500);

    // Type the tweet text
    await page.keyboard.type(text, { delay: 30 });
    await page.waitForTimeout(1500);

    // Click the Post button using JavaScript
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="tweetButton"]');
      if (btn) btn.click();
    });

    await page.waitForTimeout(8000);

    // Check result
    if (result) {
      const tweet = result.data?.create_tweet?.tweet_results?.result;
      if (tweet) {
        const tweetId = tweet.rest_id;
        logger.info(`Posted to X: https://x.com/i/status/${tweetId}`);
        return tweetId;
      }
      const err = result.errors?.[0]?.message;
      if (err) throw new Error(err);
    }

    // Fallback: check if we left the compose page (tweet was sent)
    if (!page.url().includes("/compose")) {
      logger.info("Tweet likely posted (navigated away from compose)");
      return "posted";
    }

    throw new Error("Could not confirm tweet was posted");
  } finally {
    await browser.close();
  }
}
