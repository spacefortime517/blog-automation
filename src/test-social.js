#!/usr/bin/env node
/**
 * Test social media posting without running the full pipeline.
 *
 * Usage:
 *   node src/test-social.js <platform>
 *   node src/test-social.js all
 *
 * Platforms: x, facebook, linkedin, instagram
 */
import "dotenv/config";
import { postToX } from "./services/x-poster.js";
import { postToFacebook } from "./services/facebook-poster.js";
import { postToLinkedIn } from "./services/linkedin-poster.js";
import { postToInstagram } from "./services/instagram-poster.js";
import { logger } from "./utils/logger.js";
import { config } from "./config.js";

const platform = process.argv[2];
if (!platform || !["x", "facebook", "linkedin", "instagram", "all"].includes(platform)) {
  console.error("Usage: node src/test-social.js <x|facebook|linkedin|instagram|all>");
  process.exit(1);
}

const articleUrl = `${config.siteUrl}/blog/test-post`;
const testText = "Testing PICKUP2 blog automation social media integration.";

const posts = {
  x: `${testText}\n\n${articleUrl}\n\n#Logistics #SupplyChain`,
  facebook: `${testText}\n\nRead more: ${articleUrl}\n\n#Logistics #EUTransport`,
  linkedin: `${testText}\n\nStay tuned for more logistics insights.\n\n#Logistics #SupplyChain #EUTransport`,
  instagram: `${testText}\n\n${articleUrl}\n\n#Logistics #SupplyChain #FreightForwarding #EULogistics #Trucking`,
};

// Use a placeholder image for Instagram (replace with a real S3 URL in production)
const testImageUrl = "https://space4timeltd.eu/logo-dark.png";

const platforms = platform === "all" ? ["x", "facebook", "linkedin", "instagram"] : [platform];

for (const p of platforms) {
  try {
    let result = null;
    logger.info(`--- Testing ${p} ---`);

    if (p === "x") {
      result = await postToX(posts.x);
    } else if (p === "facebook") {
      result = await postToFacebook(posts.facebook, articleUrl);
    } else if (p === "linkedin") {
      result = await postToLinkedIn(posts.linkedin, articleUrl, {
        title: "PICKUP2 Test Post",
        description: testText,
      });
    } else if (p === "instagram") {
      result = await postToInstagram(posts.instagram, testImageUrl);
    }

    if (result) {
      logger.info(`${p}: SUCCESS (${result})`);
    } else {
      logger.warn(`${p}: skipped (not configured)`);
    }
  } catch (err) {
    logger.error(`${p}: FAILED — ${err.message}`);
  }
}
