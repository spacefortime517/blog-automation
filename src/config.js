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
    "dk",
    "ee",
    "el",
    "fi",
    "hr",
    "hu",
    "lt",
    "lv",
    "no",
    "se",
    "sk",
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
    "dk",
    "ee",
    "el",
    "fi",
    "hr",
    "hu",
    "lt",
    "lv",
    "no",
    "se",
    "sk",
  ],
  // Editorial themes the blog should cover in a balanced mix over time
  topicThemes: [
    "EU transport regulations & compliance (customs, tolls, driving bans, Mobility Package, tachographs)",
    "Freight market trends (rates, capacity, fuel & energy costs, demand by region/season)",
    "Practical business advice for carriers (cost control, finding loads, fleet management, empty runs)",
    "Practical business advice for freight forwarders & shippers (choosing carriers, payment security, tenders)",
    "Drivers (shortage, working conditions, rest rules, recruitment)",
    "Sustainability & green logistics (e-trucks, emissions rules, alternative fuels)",
    "Digitalization & logistics tech (freight platforms, telematics, AI, real-time visibility)",
    "Safety & security (cargo theft, freight fraud, cybersecurity, dangerous goods)",
    "Transport operations (warehousing, intermodal/rail, cross-border processes, transport management)",
    "Geopolitics & supply chain disruptions (borders, strikes, war impact, trade routes)",
    "Finance in transport (payment terms, cash flow, factoring, insurance)",
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
    dk: "Danish",
    ee: "Estonian",
    el: "Greek",
    fi: "Finnish",
    hr: "Croatian",
    hu: "Hungarian",
    lt: "Lithuanian",
    lv: "Latvian",
    no: "Norwegian",
    se: "Swedish",
    sk: "Slovak",
  },
};
