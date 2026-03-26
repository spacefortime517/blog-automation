import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { postToX } from "../services/x-poster.js";
import { postToFacebook } from "../services/facebook-poster.js";
import { postToLinkedIn } from "../services/linkedin-poster.js";

/**
 * Step 9: Post to social media platforms.
 * @param {object} ai - AIProvider instance
 * @param {object} article - English article
 * @param {string} slug - Article slug
 * @returns {object} Results per platform { x, facebook, linkedin }
 */
export async function stepSocialMedia(ai, article, slug) {
  logger.step(9, "Posting to social media...");

  const articleUrl = `${config.siteUrl}/blog/${slug}`;

  // Generate platform-specific posts
  const posts = await ai.generateSocialPost(
    article.title,
    article.description,
    articleUrl
  );

  const results = { x: null, facebook: null, linkedin: null };

  // X/Twitter
  try {
    const tweetText = posts.twitter?.includes(articleUrl)
      ? posts.twitter
      : `${posts.twitter}\n\n${articleUrl}`;
    results.x = await postToX(tweetText);
  } catch (error) {
    logger.error(`X/Twitter posting failed: ${error.message}`);
  }

  // Facebook
  try {
    const fbText = posts.facebook?.includes(articleUrl)
      ? posts.facebook
      : `${posts.facebook}\n\n${articleUrl}`;
    results.facebook = await postToFacebook(fbText, articleUrl);
  } catch (error) {
    logger.error(`Facebook posting failed: ${error.message}`);
  }

  // LinkedIn
  try {
    const liText = posts.linkedin?.includes(articleUrl)
      ? posts.linkedin
      : `${posts.linkedin}\n\n${articleUrl}`;
    results.linkedin = await postToLinkedIn(liText, articleUrl, {
      title: article.title,
      description: article.description,
    });
  } catch (error) {
    logger.error(`LinkedIn posting failed: ${error.message}`);
  }

  const posted = Object.values(results).filter(Boolean).length;
  logger.step(9, `Social media done: ${posted}/3 platforms posted`);
  return results;
}
