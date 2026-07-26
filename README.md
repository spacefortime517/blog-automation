# BlogAutomation - PICKUP2

Automated blog post generation and multilingual distribution pipeline for [Space 4 Time Ltd](https://space4timeltd.eu), a household removals company moving between the UK and Europe.

Writes evergreen removals content — packing, customs and Transfer of Residence paperwork, costs, planning, and destination guides for the cities and countries the company actually serves — then translates it into the 11 other languages the website ships and publishes each one.

---

## Schedule

Three posts per week — Monday, Wednesday and Friday at 09:00 CET — published to
the website only. Each run discovers a topic, writes the English article,
generates a hero image, publishes it, then translates and publishes the other
11 languages.

Social media posting is **off**. It is opt-in rather than opt-out so that a
forgotten flag in a cron line cannot post to five networks by accident:

```bash
npm start                 # website only (what cron runs)
npm run start:with-social # website + social
npm run dry-run           # generate and print, publish nothing
```

## What It Does

The pipeline runs a **9-step automated process** that:

1. **Authenticates** with the PICKUP2 backend (JWT)
2. **Discovers** a trending EU logistics news topic via Gemini + Google Search
3. **Generates** a full SEO-optimized English blog article (title, meta description, keywords, markdown content, slug, categories)
4. **Generates** a 16:9 hero image via MiniMax Image-01
5. **Uploads** the image to S3 through the backend API
6. **Publishes** the English article
7. **Translates** to 11 languages (ES, FR, DE, IT, NL, PL, RO, TR, UA, CZ, BG) via Gemini
8. **Publishes** all translated versions
9. **Posts** to social media (X/Twitter, Facebook, LinkedIn)

Each run produces **12 published articles** (1 English + 11 translations) and **3 social media posts**.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js (ES Modules) |
| AI Generation | Google Gemini (`@google/genai`) |
| Image Generation | MiniMax Image-01 API |
| Backend Auth | JWT (`jsonwebtoken`) |
| X/Twitter Posting | Playwright (browser automation + cookie injection) |
| Facebook Posting | Graph API v25.0 |
| LinkedIn Posting | LinkedIn Posts API with OAuth token refresh |
| Config | dotenv |

---

## Project Structure

```
src/
  index.js                      # Entry point - orchestrates the 9-step pipeline
  config.js                     # Loads & validates env variables
  services/
    backend-api.js              # PICKUP2 admin API client (articles, images)
    x-poster.js                 # X/Twitter via Playwright + cookies
    facebook-poster.js          # Facebook Pages API
    linkedin-poster.js          # LinkedIn API with token refresh
    ai/
      provider.js               # AI provider interface
      gemini.js                 # Gemini implementation (content, translation, prompts)
      key-rotator.js            # Auto-rotates API keys on rate limit (429)
  steps/
    01-authenticate.js           # JWT auth + fetch existing articles for dedup
    02-discover-topic.js         # News discovery via Gemini + Google Search
    03-generate-article.js       # English article generation + slug collision check
    04-generate-image.js         # Hero image via MiniMax
    05-upload-image.js           # Image upload to S3 (via backend)
    06-publish-english.js        # Publish English article
    07-translate.js              # Translate to 11 languages
    08-publish-translations.js   # Publish all translations
    09-social-media.js           # Post to X, Facebook, LinkedIn
  utils/
    logger.js                   # Timestamped console logger
    retry.js                    # Exponential backoff retry + sleep
```

---

## Setup (Local Development)

### 1. Install dependencies

```bash
npm install
```

Playwright needs browser binaries:

```bash
npx playwright install chromium
```

### 2. Create `.env` file

```env
# === REQUIRED ===
BACKEND_URL=http://localhost:8000
ACCESS_TOKEN_SECRET=your_jwt_secret          # Must match backend
ADMIN_USER_ID=your_admin_user_id
GEMINI_API_KEYS=key1,key2,key3               # Comma-separated, supports multiple for rate limit rotation

# === IMAGE GENERATION ===
MINIMAX_API_KEY=your_minimax_api_key

# === SITE ===
SITE_URL=https://space4timeltd.eu

# === SOCIAL MEDIA (all optional) ===

# X/Twitter (cookie-based auth via Playwright)
X_AUTH_TOKEN=your_auth_token_cookie
X_CT0=your_ct0_cookie
X_KDT=your_kdt_cookie
X_TWID=your_twid_cookie

# Facebook
FB_PAGE_ID=your_page_id
FB_PAGE_ACCESS_TOKEN=your_page_access_token

# LinkedIn
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_ACCESS_TOKEN=your_access_token
LINKEDIN_REFRESH_TOKEN=your_refresh_token
LINKEDIN_PERSON_ID=your_person_id
LINKEDIN_ORG_ID=your_org_id                  # Optional, for org posts
```

### 3. Run

```bash
# Full pipeline (generate + publish + social media)
npm start

# Preview only (no publishing, no social media)
npm run dry-run

# English only (no translations, no social media)
npm run english-only
```

### CLI Flags

```bash
node src/index.js --dry-run                  # Preview mode
node src/index.js --skip-social              # Skip social media step
node src/index.js --language=de              # Single language only
node src/index.js --language de              # Alternative syntax
```

---

## VPS / Production Deployment

### What Needs to Change

#### 1. Environment Variables

Do **NOT** copy the `.env` file to production. Use your VPS's secrets management instead:

| Method | Example |
|--------|---------|
| systemd env file | `EnvironmentFile=/etc/blog-automation/.env` |
| Docker | `docker run --env-file .env.production ...` |
| Process manager | `pm2 start src/index.js --env production` |

Update these values for production:
- `BACKEND_URL` -> your production backend URL (e.g. `https://api.space4timeltd.eu`)
- `SITE_URL` -> `https://space4timeltd.eu`
- `ACCESS_TOKEN_SECRET` -> must match production backend's JWT secret

#### 2. Playwright / Chromium on VPS

Playwright needs a headless Chromium browser. On a Linux VPS:

```bash
# Install system dependencies (Ubuntu/Debian)
npx playwright install-deps chromium
npx playwright install chromium
```

If your VPS has limited resources or no GUI libraries, consider:
- Using a minimal Docker image with Playwright pre-installed
- Or skipping X/Twitter posting (`--skip-social`) and using only the API-based social integrations

#### 3. Scheduling (Cron)

The pipeline has **no built-in scheduler**. Set up a cron job:

```bash
# Run once daily at 09:00 UTC
crontab -e
0 9 * * * cd /opt/blog-automation && /usr/bin/node src/index.js >> /var/log/blog-automation.log 2>&1
```

Or with a process manager:

```bash
# PM2 cron
pm2 start src/index.js --name blog-automation --cron "0 9 * * *" --no-autorestart
```

#### 4. Logging

Logs go to stdout. In production, redirect to a file or use a log aggregator:

```bash
# Simple file logging
node src/index.js >> /var/log/blog-automation/pipeline.log 2>&1

# Or use PM2 which handles log rotation
pm2 start src/index.js --log /var/log/blog-automation/pipeline.log
```

#### 5. LinkedIn Token File

The LinkedIn integration writes refreshed tokens to `.linkedin-tokens.json` in the project root. On a VPS:
- Ensure the app has write permission to the project directory
- Back up this file — if lost, you'll need to re-authenticate LinkedIn

---

### Production Checklist

| Task | Status |
|------|--------|
| Node.js installed (v18+) | |
| `npm install --production` | |
| Playwright Chromium installed + system deps | |
| `.env` configured with production values | |
| `BACKEND_URL` points to production backend | |
| `ACCESS_TOKEN_SECRET` matches production backend | |
| Gemini API keys set (multiple recommended) | |
| MiniMax API key set | |
| Social media credentials configured | |
| Cron job or scheduler set up | |
| Log directory created with write permissions | |
| `.linkedin-tokens.json` writable path | |
| Firewall allows outbound HTTPS (APIs, Gemini, MiniMax, social) | |

---

### Docker (Optional)

If you prefer containerized deployment:

```dockerfile
FROM node:20-slim

RUN npx playwright install-deps chromium

WORKDIR /app
COPY package*.json ./
RUN npm install --production
RUN npx playwright install chromium

COPY src/ src/

CMD ["node", "src/index.js"]
```

```bash
docker build -t blog-automation .
docker run --env-file .env.production blog-automation
```

---

## API Keys & Tokens - Maintenance Notes

| Credential | Expires? | How to Refresh |
|------------|----------|----------------|
| Gemini API Keys | No | Manage at [Google AI Studio](https://aistudio.google.com/apikey) |
| MiniMax API Key | No | Manage in MiniMax dashboard |
| X/Twitter Cookies | Yes (~30-90 days) | Extract fresh cookies from browser DevTools (Application > Cookies > x.com) |
| Facebook Page Token | Depends | Long-lived tokens last ~60 days; convert to never-expiring via Graph API Explorer |
| LinkedIn Tokens | Yes | Auto-refreshed by the app; if both expire, re-authenticate via OAuth flow |
| JWT Secret | No | Must match backend; rotate in sync |

---

## Error Handling

- **Image generation failure** -> Pipeline continues without hero image
- **Social media failure** -> Logged but does not fail the pipeline
- **API rate limits (Gemini)** -> Auto-rotates to next API key; retries with exponential backoff
- **Slug collision** -> Appends date suffix automatically (e.g. `eu-logistics-news-2026-03-26`)
- **409 conflict (article exists)** -> Skips publishing, continues pipeline
- **LinkedIn 401** -> Attempts token refresh, retries once

---

## Supported Languages

| Code | Language |
|------|----------|
| en | English (source) |
| es | Spanish |
| fr | French |
| de | German |
| it | Italian |
| nl | Dutch |
| pl | Polish |
| ro | Romanian |
| tr | Turkish |
| ua | Ukrainian |
| cz | Czech |
| bg | Bulgarian |

---

## Article Categories

`shippers` | `forwarders` | `carriers` | `managers` | `feedback` | `general`

Categories are auto-assigned by Gemini based on article content.
