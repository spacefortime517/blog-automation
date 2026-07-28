import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { getAIProvider } from "./services/ai/provider.js";
import { stepAuthenticate } from "./steps/01-authenticate.js";
import { stepDiscoverTopic } from "./steps/02-discover-topic.js";
import { stepGenerateArticle } from "./steps/03-generate-article.js";
import { stepGenerateImage } from "./steps/04-generate-image.js";
import { stepUploadImage } from "./steps/05-upload-image.js";
import { stepPublishEnglish } from "./steps/06-publish-english.js";
import { stepTranslate } from "./steps/07-translate.js";
import { stepPublishTranslations } from "./steps/08-publish-translations.js";
import { stepSocialMedia } from "./steps/09-social-media.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PENDING_FILE = join(__dirname, "../data/pending-social.json");

// Parse CLI flags
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
// Social posting is opt-in, not opt-out. Publishing to the website is the job;
// posting to five networks is a separate decision that should never happen by
// accident because a flag was forgotten in a cron line.
const socialEnabled =
  (args.includes("--with-social") || config.enableSocial) &&
  !args.includes("--skip-social");
const singleLang = args.find((a) => a.startsWith("--language="))?.split("=")[1]
  || (args.includes("--language") ? args[args.indexOf("--language") + 1] : null);

async function main() {
  const startTime = Date.now();
  // Set when the article went out incomplete; turned into a non-zero exit below.
  let publishIncomplete = null;
  logger.info("=== BlogAutomation Pipeline Starting ===");
  if (dryRun) logger.info("DRY RUN MODE — no publishing, no social media");
  logger.info(
    socialEnabled
      ? "Social media posting ENABLED for this run"
      : "Website only — social media posting is off (enable with --with-social)"
  );
  if (singleLang) logger.info(`Single language mode: ${singleLang}`);

  // Step 1: Authenticate
  const existingArticles = await stepAuthenticate();

  // Step 2: Discover topic
  const ai = await getAIProvider();
  const topic = await stepDiscoverTopic(ai, existingArticles);

  // Step 3: Generate English article
  const article = await stepGenerateArticle(ai, topic);

  if (dryRun) {
    logger.info("\n--- DRY RUN RESULT ---");
    logger.info(`Title: ${article.title}`);
    logger.info(`Slug: ${article.slug}`);
    logger.info(`Description: ${article.description}`);
    logger.info(`Keywords: ${article.keywords.join(", ")}`);
    logger.info(`Categories: ${article.categories.join(", ")}`);
    logger.info(`Content length: ${article.content.split(/\s+/).length} words`);
    logger.info(`Content preview: ${article.content.substring(0, 300)}...`);
    logger.info("--- END DRY RUN ---\n");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Pipeline completed (dry run) in ${elapsed}s`);
    return;
  }

  // Which languages this article has to exist in before anything goes live.
  const targetLangs = singleLang
    ? singleLang === "en"
      ? []
      : [singleLang]
    : config.targetLanguages;

  // Step 4: Generate hero image
  const imageBuffer = await stepGenerateImage(ai, article.title, article.description);
  if (!imageBuffer) {
    // Publishing without one doesn't mean "no picture" — the website falls back
    // to /images/blog/default.jpg, the stock shot of our two vans, on every
    // card and every language. One generic image on every post is worse than
    // waiting for the next run.
    throw new Error(
      "No hero image was generated — refusing to publish, the site would show the default van photo instead"
    );
  }

  // Step 5: Upload image
  const imgUrl = await stepUploadImage(imageBuffer, article.slug);

  // Step 6: Translate BEFORE anything is published.
  //
  // The order used to be publish-English-then-translate, which meant a failure
  // in translation left a finished English post on a site that serves twelve
  // languages — the other eleven showing "no articles found" while English had
  // one. Translating first makes the whole article all-or-nothing: if it can't
  // be produced in every language it isn't published in any, and the next run
  // tries again.
  let translations = [];
  const origTargetLangs = config.targetLanguages;
  if (targetLangs.length) {
    if (singleLang) config.targetLanguages = targetLangs;
    try {
      translations = await stepTranslate(ai, article);
    } finally {
      if (singleLang) config.targetLanguages = origTargetLangs;
    }

    if (translations.length < targetLangs.length) {
      const missing = targetLangs.filter(
        (l) => !translations.some((t) => t.language === l)
      );
      throw new Error(
        `Only ${translations.length}/${targetLangs.length} translations succeeded ` +
          `(missing: ${missing.join(", ")}) — refusing to publish an article that ` +
          `would exist in some languages and not others`
      );
    }
  } else {
    logger.info("Single language mode (en), skipping translations.");
  }

  // Step 7: Publish English
  const { articleId } = await stepPublishEnglish(article, imgUrl);

  // Step 8: Publish the translations that are already in hand
  if (translations.length) {
    const result = await stepPublishTranslations(translations, articleId, article, imgUrl);
    if (result.published < translations.length) {
      publishIncomplete =
        `${article.slug}: ${result.published}/${translations.length} translations published — ` +
        `the article is live but incomplete, backfill the rest`;
    }
  }

  // Step 9: Social media
  const articleUrl = `${config.siteUrl}/blog/${article.slug}`;
  if (socialEnabled) {
    if (args.includes("--post-now")) {
      // Post immediately to all platforms (legacy behavior, no pending file)
      logger.step(9, "Posting to all platforms immediately (--post-now)");
      await stepSocialMedia(ai, article, article.slug, imgUrl);
    } else {
      // Save pending social data for staggered posting via cron
      const pendingData = {
        createdAt: new Date().toISOString(),
        articleUrl,
        imgUrl: imgUrl || "",
        article: {
          title: article.title,
          description: article.description,
          slug: article.slug,
        },
        posts: null, // Generated on first social post
        posted: {},
      };
      mkdirSync(join(__dirname, "../data"), { recursive: true });
      writeFileSync(PENDING_FILE, JSON.stringify(pendingData, null, 2));
      logger.step(9, "Pending social data saved. Posts will be staggered via cron.");
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (publishIncomplete) {
    logger.error(`\n=== Pipeline finished INCOMPLETE in ${elapsed}s ===`);
    logger.error(publishIncomplete);
    logger.error(`Article: ${articleUrl}`);
    // Non-zero so Actions shows red. The English article is live either way —
    // this is a flag to go and backfill, not a signal that nothing happened.
    process.exitCode = 1;
    return;
  }

  logger.info(`\n=== Pipeline completed successfully in ${elapsed}s ===`);
  logger.info(`Article: ${articleUrl}`);
}

main().catch((error) => {
  logger.error(`Pipeline failed: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});
