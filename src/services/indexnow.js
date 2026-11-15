import { config } from "../config.js";
import { logger } from "../utils/logger.js";

// The key is public by design: the website serves it at /<key>.txt
// (website/public/<key>.txt) so the search engines can check ownership.
const KEY = process.env.INDEXNOW_KEY || "93899ec0dfc73cd2d000ff462c5f39a1";
const ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Tell Bing and the other IndexNow engines (Yandex, Seznam, Naver…) about new
 * pages so they are crawled within hours instead of weeks. Best effort: a
 * failure is logged and never stops the pipeline.
 * @param {string[]} urls - absolute URLs on config.siteUrl
 */
export async function submitToIndexNow(urls) {
  const site = new URL(config.siteUrl);
  const urlList = [...new Set(urls)].filter((u) => {
    try {
      return new URL(u).host === site.host;
    } catch {
      return false;
    }
  });
  if (!urlList.length) return;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: site.host,
        key: KEY,
        keyLocation: `${site.origin}/${KEY}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.status >= 300) {
      logger.warn(`IndexNow: HTTP ${res.status} for ${urlList.length} URLs: ${await res.text()}`);
    } else {
      logger.info(`IndexNow: submitted ${urlList.length} URLs (HTTP ${res.status})`);
    }
  } catch (error) {
    logger.warn(`IndexNow: ${error.message}`);
  }
}
