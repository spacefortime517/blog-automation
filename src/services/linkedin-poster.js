import { chromium } from "playwright";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Post to LinkedIn using Google SSO authentication.
 * Injects Google cookies → LinkedIn login → "Continue with Google" → post.
 * @param {string} text - Post text with URL and hashtags
 * @returns {boolean} true if posted successfully
 */
export async function postToLinkedIn(text) {
  if (!config.linkedin.googleCookies) {
    logger.warn("LinkedIn: Google cookies not configured, skipping");
    return null;
  }

  logger.info("Posting to LinkedIn via Google SSO...");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });

    // Hide automation
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      delete window.__playwright;
      delete window.__pw_manual;
    });

    // Inject Google authentication cookies
    await context.addCookies(config.linkedin.googleCookies);

    const page = await context.newPage();

    // Go to LinkedIn login
    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // If already on feed, skip login
    if (page.url().includes("/feed")) {
      logger.info("Already logged in to LinkedIn");
    } else {
      // Accept cookies (required for Google SSO — it needs third-party cookies)
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find(
          (b) => b.textContent.trim() === "Accept"
        );
        if (btn) btn.click();
      });
      await page.waitForTimeout(1000);

      // Click "Continue with Google" — opens a popup window
      const popupPromise = context.waitForEvent("page", { timeout: 15000 });

      const googleIframe = page.locator(
        'iframe[src*="accounts.google.com/gsi/button"]'
      ).first();
      await googleIframe.waitFor({ state: "visible", timeout: 10000 });
      const box = await googleIframe.boundingBox();
      if (!box) throw new Error("Google SSO iframe not found");
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      logger.info("Clicked 'Continue with Google', waiting for popup...");

      // Handle Google popup
      const popup = await popupPromise;
      await popup.waitForLoadState("domcontentloaded");
      await popup.waitForTimeout(2000);
      logger.info("Google popup URL: " + popup.url().substring(0, 80));

      // Select the correct Google account
      const accountEmail = "omurtag@pickup2.com";
      const accountEl = popup.locator(`[data-email="${accountEmail}"]`).first();
      if (await accountEl.isVisible().catch(() => false)) {
        await accountEl.click();
        logger.info("Selected account: " + accountEmail);
      } else {
        // Try clicking by email text
        const emailLink = popup.locator(`text=${accountEmail}`).first();
        if (await emailLink.isVisible().catch(() => false)) {
          await emailLink.click();
          logger.info("Selected account by text: " + accountEmail);
        } else {
          // Click first available account
          const firstAccount = popup.locator('[data-authuser="0"], .JDAKTe').first();
          if (await firstAccount.isVisible().catch(() => false)) {
            await firstAccount.click();
            logger.info("Selected first available account");
          }
        }
      }

      // Wait for popup to close and main page to redirect
      await popup.waitForEvent("close", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);

      // Wait for LinkedIn feed
      try {
        await page.waitForURL("**/linkedin.com/feed**", { timeout: 15000 });
      } catch {
        if (page.url().includes("/login")) {
          throw new Error("Google SSO failed — still on login page");
        }
      }
      await page.waitForTimeout(2000);
      logger.info("Google SSO login successful, URL: " + page.url());
    }

    // Ensure we're on the feed
    if (!page.url().includes("/feed")) {
      await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      await page.waitForTimeout(2000);
    }

    // Click "Start a post" area
    await page.waitForTimeout(3000);
    const startClicked = await page.evaluate(() => {
      // Try multiple approaches
      const btn = document.querySelector('button.share-box-feed-entry__trigger')
        || document.querySelector('[class*="share-box"] button')
        || [...document.querySelectorAll('button')].find(b => b.textContent.includes('Start a post'));
      if (btn) { btn.click(); return 'button'; }
      // Try the text input area
      const input = document.querySelector('[class*="share-box"] [role="button"]');
      if (input) { input.click(); return 'input'; }
      return null;
    });
    if (!startClicked) throw new Error("Could not find 'Start a post' on LinkedIn feed");
    logger.info("Opened post editor");
    await page.waitForTimeout(2000);

    // Wait for Quill editor
    await page.locator(".ql-editor").first().waitFor({ state: "visible", timeout: 10000 });

    // Insert text via JS (LinkedIn's Quill editor)
    await page.evaluate((postText) => {
      const el = document.querySelector(".ql-editor");
      el.innerHTML = postText
        .split("\n\n")
        .map((p) => "<p>" + p + "</p>")
        .join("");
      el.classList.remove("ql-blank");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, text);

    await page.waitForTimeout(2000);

    // Click Post
    await page.locator("button.share-actions__primary-action").first().click();
    await page.waitForTimeout(5000);

    logger.info("Posted to LinkedIn successfully");
    return true;
  } finally {
    await browser.close();
  }
}
