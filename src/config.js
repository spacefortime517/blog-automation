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

function buildGoogleCookies() {
  // Parse GOOGLE_COOKIES env var: "name1=value1;name2=value2;..."
  const raw = process.env.GOOGLE_COOKIES;
  if (!raw) return null;

  return raw.split(";").map((pair) => {
    const eqIdx = pair.indexOf("=");
    const name = pair.substring(0, eqIdx).trim();
    const value = pair.substring(eqIdx + 1).trim();
    return {
      name,
      value,
      domain: ".google.com",
      path: "/",
      secure: true,
      httpOnly: name.startsWith("__Secure-"),
      sameSite: name.includes("3P") ? "None" : "Lax",
    };
  });
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

  // LinkedIn (via Google SSO cookies)
  linkedin: {
    googleCookies: buildGoogleCookies(),
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
