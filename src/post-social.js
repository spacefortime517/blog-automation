import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { getAIProvider } from "./services/ai/provider.js";
import { postToX } from "./services/x-poster.js";
import { postToFacebook } from "./services/facebook-poster.js";
import { postToLinkedIn } from "./services/linkedin-poster.js";
import { postToInstagram } from "./services/instagram-poster.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PENDING_FILE = join(__dirname, "../data/pending-social.json");

function loadPending() {
  if (!existsSync(PENDING_FILE)) {
    return null;
  }
  return JSON.parse(readFileSync(PENDING_FILE, "utf-8"));
}

function savePending(data) {
  writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
}

async function main() {
  const platform = process.argv[2];

  if (!platform || !["linkedin", "x", "facebook", "instagram", "all"].includes(platform)) {
    console.error("Usage: node src/post-social.js <linkedin|x|facebook|instagram|all>");
    process.exit(1);
  }

  const pending = loadPending();
  if (!pending) {
    logger.warn("No pending social posts found. Run the main pipeline first.");
    process.exit(0);
  }

  // Check if this was generated today (use local date to match cron timezone)
  const toLocalDate = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };
  const pendingDate = toLocalDate(pending.createdAt);
  const today = toLocalDate(new Date());
  if (pendingDate !== today) {
    logger.warn(
      `Pending social data is from ${pendingDate}, not today (${today}). Skipping to avoid posting stale content.`
    );
    process.exit(0);
  }

  const platforms = platform === "all" ? ["linkedin", "x", "facebook", "instagram"] : [platform];

  // Generate posts if not already generated
  if (!pending.posts) {
    logger.info("Generating social media posts...");
    const ai = await getAIProvider();
    pending.posts = await ai.generateSocialPost(
      pending.article.title,
      pending.article.description,
      pending.articleUrl
    );
    savePending(pending);
  }

  for (const p of platforms) {
    if (pending.posted?.[p]) {
      logger.info(`Already posted to ${p} today, skipping.`);
      continue;
    }

    try {
      let result = null;

      if (p === "linkedin") {
        result = await postToLinkedIn(pending.posts.linkedin, pending.articleUrl, {
          title: pending.article.title,
          description: pending.article.description,
        });
      } else if (p === "x") {
        const tweetText = pending.posts.twitter?.includes(pending.articleUrl)
          ? pending.posts.twitter
          : `${pending.posts.twitter}\n\n${pending.articleUrl}`;
        result = await postToX(tweetText);
      } else if (p === "facebook") {
        const fbText = pending.posts.facebook?.includes(pending.articleUrl)
          ? pending.posts.facebook
          : `${pending.posts.facebook}\n\n${pending.articleUrl}`;
        result = await postToFacebook(fbText, pending.articleUrl);
      } else if (p === "instagram") {
        const igCaption = pending.posts.instagram?.includes(pending.articleUrl)
          ? pending.posts.instagram
          : `${pending.posts.instagram}\n\n${pending.articleUrl}`;
        result = await postToInstagram(igCaption, pending.imgUrl);
      }

      if (result) {
        if (!pending.posted) pending.posted = {};
        pending.posted[p] = { id: result, at: new Date().toISOString() };
        savePending(pending);
        logger.info(`Successfully posted to ${p}`);
      }
    } catch (error) {
      logger.error(`Failed to post to ${p}: ${error.message}`);
    }
  }

  const postedCount = Object.keys(pending.posted || {}).length;
  logger.info(`Social posting done: ${postedCount}/4 platforms completed.`);
}

main().catch((error) => {
  logger.error(`Social posting failed: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});
