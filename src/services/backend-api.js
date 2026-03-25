import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

let authToken = null;

/**
 * Sign a JWT token for admin API access.
 * Uses the same ACCESS_TOKEN_SECRET as the Server.
 */
export function authenticate() {
  authToken = jwt.sign(
    { userId: config.adminUserId },
    config.accessTokenSecret,
    { expiresIn: "30m" }
  );
  logger.info("JWT token signed for admin API access");
  return authToken;
}

function headers(extraHeaders = {}) {
  return {
    Authorization: `Bearer ${authToken}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

async function apiCall(method, path, body = null, extraHeaders = {}) {
  const url = `${config.backendUrl}${path}`;
  const opts = {
    method,
    headers: headers(extraHeaders),
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.message || res.statusText;
    const err = new Error(`API ${method} ${path} failed (${res.status}): ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/** Verify auth works by fetching articles */
export async function verifyAuth() {
  const result = await apiCall("GET", "/admin/articles?language=en");
  logger.info(`Auth verified. Found ${result.data?.length || 0} English articles.`);
  return result.data || [];
}

/** Get all English articles (for deduplication) */
export async function getEnglishArticles() {
  const result = await apiCall("GET", "/admin/articles?language=en");
  return result.data || [];
}

/** Get next sequential article ID */
export async function getNextId() {
  const result = await apiCall("GET", "/admin/next-id");
  logger.info(`Next article ID: ${result.nextId}`);
  return result.nextId;
}

/** Create a new blog article */
export async function createArticle(articleData) {
  return withRetry(
    () => apiCall("POST", "/admin/create-article", articleData),
    { maxRetries: 3, label: `createArticle(${articleData.language})` }
  );
}

/** Upload an image buffer to S3 via the admin API */
export async function uploadImage(imageBuffer, filename = "blog-hero.png") {
  const blob = new Blob([imageBuffer], { type: "image/png" });
  const form = new globalThis.FormData();
  form.append("images", blob, filename);

  const url = `${config.backendUrl}/admin/upload-images`;
  const result = await withRetry(
    async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.message || res.statusText;
        throw new Error(`Upload failed (${res.status}): ${msg}`);
      }
      return data;
    },
    { maxRetries: 3, label: "uploadImage" }
  );

  const imgUrl = result.imageUrls?.[0];
  if (!imgUrl) throw new Error("No image URL returned from upload");
  logger.info(`Image uploaded: ${imgUrl.substring(0, 80)}...`);
  return imgUrl;
}

/** Check if a slug already exists */
export async function checkSlugExists(slug, language = "en") {
  try {
    await apiCall("GET", `/blog/${slug}/${language}`);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}
