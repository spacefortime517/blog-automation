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
  // Social posting is OFF unless explicitly turned on. The blog publishes to
  // the website only; social is opt-in per run or via this flag.
  enableSocial: process.env.ENABLE_SOCIAL === "true",
  geminiApiKeys: process.env.GEMINI_API_KEYS.split(",").map((k) => k.trim()),
  siteUrl: process.env.SITE_URL || "https://space4timeltd.eu",
  // Byline for every generated article. Sent explicitly rather than leaning on
  // the server's fallback, so changing that default cannot silently rewrite the
  // author on everything this pipeline has published.
  author: process.env.BLOG_AUTHOR || "Space4Time",

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

  // Constants — these are exactly the locales the website ships translations
  // for. Publishing anything else creates articles no page can render.
  languages: [
    "en",
    "bg",
    "cz",
    "de",
    "es",
    "fr",
    "it",
    "nl",
    "pl",
    "ro",
    "tr",
    "ua",
  ],
  targetLanguages: [
    "bg",
    "cz",
    "de",
    "es",
    "fr",
    "it",
    "nl",
    "pl",
    "ro",
    "tr",
    "ua",
  ],

  // Editorial themes for a UK <-> Europe removals blog. The audience is people
  // moving home or moving abroad, not logistics professionals.
  topicThemes: [
    "Destination guides (moving to a specific city or country: cost of living, paperwork, neighbourhoods, what to expect)",
    "Customs & paperwork for international moves (ToR relief, proof of address, inventories, restricted goods)",
    "Packing (fragile items, electronics, labelling, materials, essentials box, downsizing)",
    "Planning & timelines (how far ahead to book, checklists, moving day, what to do before the crew arrives)",
    "Costs & pricing (what drives the price of a move, part load vs dedicated van, saving money, hidden costs)",
    "Moving logistics & access (parking, external lifts, stairs and lifts, difficult access, storage)",
    "Settling in (making a new city feel like home, renting vs buying, first weeks abroad)",
    "Seasonal moving (winter moves, summer peak season, weekend vs weekday, school-year timing)",
    "Special items (pianos, artwork, plants, vehicles, inherited belongings)",
    "Practical decisions (DIY vs professional movers, choosing a removals company, insurance)",
  ],

  // Destination backlog for evergreen city and country guides. These are the
  // routes the company actually runs, so the advice can be first-hand rather
  // than generic.
  destinations: [
    "London", "Manchester", "Birmingham", "Edinburgh", "Bristol",
    "Sofia", "Plovdiv", "Varna", "Bucharest", "Budapest", "Prague",
    "Warsaw", "Krakow", "Berlin", "Munich", "Hamburg", "Vienna",
    "Amsterdam", "Rotterdam", "Brussels", "Paris", "Lyon", "Marseille",
    "Madrid", "Barcelona", "Valencia", "Malaga", "Alicante",
    "Lisbon", "Porto", "Rome", "Milan", "Naples", "Athens",
    "Copenhagen", "Stockholm", "Oslo", "Dublin", "Zurich",
    "Bulgaria", "Romania", "Poland", "Germany", "Spain", "Portugal",
    "France", "Italy", "Greece", "Netherlands", "Czech Republic",
  ],

  categories: [
    "moving-guides",
    "destinations",
    "packing",
    "customs",
    "costs",
    "company",
  ],
  languageNames: {
    bg: "Bulgarian",
    cz: "Czech",
    de: "German",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    nl: "Dutch",
    pl: "Polish",
    ro: "Romanian",
    tr: "Turkish",
    ua: "Ukrainian",
  },
};
