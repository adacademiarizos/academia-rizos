import nodemailer from "nodemailer";
import { google } from "googleapis";
import { env } from "@/lib/env";

const oAuth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

if (env.GMAIL_REFRESH_TOKEN) {
  oAuth2Client.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
}

export async function createGmailTransport() {
  const { token: accessToken } = await oAuth2Client.getAccessToken();

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: env.GMAIL_USER,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      refreshToken: env.GMAIL_REFRESH_TOKEN,
      accessToken: accessToken as string,
    },
  });
}
