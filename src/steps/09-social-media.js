import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { postToX } from "../services/x-poster.js";
import { postToFacebook } from "../services/facebook-poster.js";
import { postToLinkedIn } from "../services/linkedin-poster.js";
import { postToInstagram } from "../services/instagram-poster.js";

/**
 * Step 9: Post to social media platforms.
 * @param {object} ai - AIProvider instance
 * @param {object} article - English article
 * @param {string} slug - Article slug
 * @param {string} [imgUrl] - Public image URL for image-based platforms
 * @returns {object} Results per platform { x, facebook, linkedin, instagram }
 */
export async function stepSocialMedia(ai, article, slug, imgUrl) {
  logger.step(9, "Posting to social media...");

  const articleUrl = `${config.siteUrl}/blog/${slug}`;

  // Generate platform-specific posts
  const posts = await ai.generateSocialPost(
    article.title,
    article.description,
    articleUrl
  );

  const results = { x: null, facebook: null, linkedin: null, instagram: null };

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

  // Instagram
  try {
    const igCaption = posts.instagram?.includes(articleUrl)
      ? posts.instagram
      : `${posts.instagram}\n\n${articleUrl}`;
    results.instagram = await postToInstagram(igCaption, imgUrl);
  } catch (error) {
    logger.error(`Instagram posting failed: ${error.message}`);
  }

  const posted = Object.values(results).filter(Boolean).length;
  logger.step(9, `Social media done: ${posted}/4 platforms posted`);
  return results;
}
