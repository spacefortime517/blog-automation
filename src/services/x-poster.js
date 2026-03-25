import { chromium } from "playwright";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Post a tweet to X/Twitter using browser cookie injection.
 * Refactored from /Applications/PICKUP2/x-bot/index.js
 * @param {string} text - Tweet text
 * @returns {string} Tweet ID
 */
export async function postToX(text) {
  const { authToken, ct0, kdt, twid } = config.x;

  if (!authToken || !ct0) {
    logger.warn("X/Twitter cookies not configured, skipping X post");
    return null;
  }

  logger.info("Posting to X/Twitter...");

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });

    // Hide automation markers
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (params) =>
        params.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(params);
      delete window.__playwright;
      delete window.__pw_manual;
    });

    // Inject session cookies
    await context.addCookies([
      {
        name: "auth_token",
        value: authToken,
        domain: ".x.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None",
      },
      {
        name: "ct0",
        value: ct0,
        domain: ".x.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax",
      },
      {
        name: "kdt",
        value: kdt || "",
        domain: ".x.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None",
      },
      {
        name: "twid",
        value: twid || "",
        domain: ".x.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None",
      },
      {
        name: "lang",
        value: "en",
        domain: "x.com",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();

    // Capture API response
    let result = null;
    page.on("response", async (res) => {
      if (res.url().includes("/CreateTweet")) {
        try {
          result = await res.json();
        } catch {}
      }
    });

    await page.goto("https://x.com/compose/post", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    if (page.url().includes("/login") || page.url().includes("/i/flow")) {
      throw new Error(
        "X cookies expired. Update .env with fresh cookies from browser DevTools."
      );
    }

    // Type tweet
    const dialog = page.locator(
      '[role="dialog"] [data-testid="tweetTextarea_0"]'
    );
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.click();
    } else {
      await page
        .locator('[data-testid="tweetTextarea_0"]')
        .first()
        .click();
    }
    await page.keyboard.type(text, { delay: 50 });
    await page.waitForTimeout(1000);

    // Click post
    const dialogBtn = page.locator(
      '[role="dialog"] [data-testid="tweetButton"]'
    );
    if (await dialogBtn.isVisible().catch(() => false)) {
      await dialogBtn.click();
    } else {
      await page.locator('[data-testid="tweetButton"]').first().click();
    }

    await page.waitForTimeout(5000);

    // Verify
    if (!result) throw new Error("No API response captured from X.");

    const tweet = result.data?.create_tweet?.tweet_results?.result;
    if (tweet) {
      const tweetId = tweet.rest_id;
      logger.info(`Posted to X: https://x.com/i/status/${tweetId}`);
      return tweetId;
    }

    const err =
      result.errors?.[0]?.message || JSON.stringify(result).substring(0, 200);
    throw new Error(err);
  } finally {
    await browser.close();
  }
}
