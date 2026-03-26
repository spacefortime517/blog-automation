#!/usr/bin/env node
import "dotenv/config";
import { createServer } from "http";
import { URL } from "url";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3333/callback";
const SCOPES = "w_member_social w_organization_social r_organization_social openid profile";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env first");
  process.exit(1);
}

const authUrl =
  `https://www.linkedin.com/oauth/v2/authorization?` +
  `response_type=code&client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPES)}`;

console.log("\n=== LinkedIn OAuth Setup ===\n");
console.log("1. Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n2. Authorize the app. You'll be redirected back here.\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3333`);

  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h1>Error: ${error}</h1><p>${url.searchParams.get("error_description")}</p>`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end("<h1>Missing authorization code</h1>");
    return;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || JSON.stringify(tokenData));
    }

    // Save tokens
    const tokenFile = join(__dirname, "../../.linkedin-tokens.json");
    writeFileSync(tokenFile, JSON.stringify(tokenData, null, 2));

    console.log("\nTokens received successfully!");
    console.log(`  Access token expires in: ${Math.round(tokenData.expires_in / 86400)} days`);
    if (tokenData.refresh_token) {
      console.log(`  Refresh token expires in: ${Math.round(tokenData.refresh_token_expires_in / 86400)} days`);
    }
    console.log(`\nTokens saved to: ${tokenFile}`);
    console.log("\nAdd these to your .env file:");
    console.log(`  LINKEDIN_ACCESS_TOKEN=${tokenData.access_token}`);
    if (tokenData.refresh_token) {
      console.log(`  LINKEDIN_REFRESH_TOKEN=${tokenData.refresh_token}`);
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>LinkedIn OAuth Complete!</h1><p>You can close this tab. Check the terminal for your tokens.</p>");
  } catch (err) {
    console.error("Token exchange failed:", err.message);
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h1>Token exchange failed</h1><p>${err.message}</p>`);
  }

  server.close();
});

server.listen(3333, () => {
  console.log("Waiting for callback on http://localhost:3333/callback ...\n");
});
