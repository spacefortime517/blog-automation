import "dotenv/config";

const required = [
  "BACKEND_URL",
  "ACCESS_TOKEN_SECRET",
  "ADMIN_USER_ID",
  "GEMINI_API_KEYS",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env variable: ${key}`);
    process.exit(1);
  }
}


export const config = {
  backendUrl: process.env.BACKEND_URL,
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  adminUserId: process.env.ADMIN_USER_ID,
  aiProvider: process.env.AI_PROVIDER || "gemini",
  geminiApiKeys: process.env.GEMINI_API_KEYS.split(",").map((k) => k.trim()),
  siteUrl: process.env.SITE_URL || "https://pickup2.com",

  // X/Twitter
  x: {
    authToken: process.env.X_AUTH_TOKEN,
    ct0: process.env.X_CT0,
    kdt: process.env.X_KDT,
    twid: process.env.X_TWID,
  },

  // Facebook
  facebook: {
    pageId: process.env.FB_PAGE_ID,
    pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN,
  },

  // Instagram
  instagram: {
    userId: process.env.INSTAGRAM_USER_ID,
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN,
  },

  // LinkedIn (API)
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
    refreshToken: process.env.LINKEDIN_REFRESH_TOKEN,
    orgId: process.env.LINKEDIN_ORG_ID,
    personId: process.env.LINKEDIN_PERSON_ID,
  },

  // Constants
  languages: [
    "en",
    "es",
    "fr",
    "de",
    "it",
    "nl",
    "pl",
    "ro",
    "tr",
    "ua",
    "cz",
    "bg",
  ],
  targetLanguages: [
    "es",
    "fr",
    "de",
    "it",
    "nl",
    "pl",
    "ro",
    "tr",
    "ua",
    "cz",
    "bg",
  ],
  categories: [
    "shippers",
    "forwarders",
    "carriers",
    "managers",
    "feedback",
    "general",
  ],
  languageNames: {
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    nl: "Dutch",
    pl: "Polish",
    ro: "Romanian",
    tr: "Turkish",
    ua: "Ukrainian",
    cz: "Czech",
    bg: "Bulgarian",
  },
};
