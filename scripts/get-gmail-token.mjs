/**
 * get-gmail-token.mjs
 *
 * One-time helper to obtain a Gmail OAuth2 refresh token.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node scripts/get-gmail-token.mjs
 *
 * Prerequisites in Google Cloud Console:
 *   1. Open the OAuth 2.0 credentials for your app
 *   2. Add "https://developers.google.com/oauthplayground" as an Authorized Redirect URI
 *   3. Make sure the Gmail API is enabled for your project
 *
 * Steps:
 *   1. Run this script — it will print an authorization URL
 *   2. Open the URL in a browser while signed in as adobeinformacion2020@gmail.com
 *   3. Grant access to "Send email on your behalf"
 *   4. Copy the authorization code from the redirect URL (?code=...)
 *   5. Paste it here — the script prints your GMAIL_REFRESH_TOKEN
 *   6. Add to .env.local:
 *        GMAIL_USER=adobeinformacion2020@gmail.com
 *        GMAIL_REFRESH_TOKEN=<printed value>
 */

import { google } from "googleapis";
import * as readline from "readline";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "https://developers.google.com/oauthplayground";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "\n❌  Missing env vars.\n\nRun with:\n  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/get-gmail-token.mjs\n"
  );
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // forces refresh_token to be returned even if previously authorized
  scope: ["https://mail.google.com/"],
});

console.log("\n──────────────────────────────────────────────────────────");
console.log("Step 1: Open this URL in your browser (as adobeinformacion2020@gmail.com)");
console.log("──────────────────────────────────────────────────────────\n");
console.log(authUrl);
console.log("\n──────────────────────────────────────────────────────────");
console.log("Step 2: After authorizing, paste the authorization code below");
console.log("        (the ?code= value from the redirect URL)");
console.log("──────────────────────────────────────────────────────────\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Authorization code: ", async (code) => {
  rl.close();
  try {
    const { tokens } = await oAuth2Client.getToken(code.trim());
    if (!tokens.refresh_token) {
      console.error(
        "\n❌  No refresh_token in response. " +
          "Make sure you used prompt:'consent' and this is a fresh authorization.\n" +
          "   Try revoking app access at https://myaccount.google.com/permissions then run again.\n"
      );
      process.exit(1);
    }
    console.log("\n✅  Success! Add these to your .env.local:\n");
    console.log(`GMAIL_USER=adobeinformacion2020@gmail.com`);
    console.log(`GMAIL_REFRESH_TOKEN="${tokens.refresh_token}"\n`);
  } catch (err) {
    console.error("\n❌  Error exchanging code for tokens:", err.message ?? err);
    process.exit(1);
  }
});
