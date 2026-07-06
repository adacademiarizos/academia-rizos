import crypto from "node:crypto";

export const GDPR_GUEST_RETENTION_MONTHS = 24;
export const GDPR_USER_DELETED_NAME = "Usuario eliminado";
export const GDPR_COMMENT_PLACEHOLDER = "[comentario eliminado]";
export const GDPR_CHAT_PLACEHOLDER = "[mensaje eliminado]";
export const GDPR_BUG_TITLE_PLACEHOLDER = "[bug anonimizado]";
export const GDPR_BUG_DESCRIPTION_PLACEHOLDER =
  "El contenido original fue eliminado por solicitud RGPD.";
export const GDPR_ANON_DOMAIN = "anon.apoteosicas.local";

type DeletionTokenPayload = {
  userId: string;
  requestId: string;
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getTokenSecret(secret?: string) {
  return secret ?? process.env.NEXTAUTH_SECRET ?? "";
}

export function buildDeletedEmail(scope: string, entityId: string) {
  const normalizedScope = scope.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `deleted-${normalizedScope}-${entityId}@${GDPR_ANON_DOMAIN}`;
}

export function buildGuestRetentionCutoff(now: Date = new Date()) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - GDPR_GUEST_RETENTION_MONTHS);
  return cutoff;
}

export function maskEmailAddress(email: string | null | undefined) {
  if (!email) return "No disponible";

  const [localPart, domain = ""] = email.split("@");
  if (!localPart) return "No disponible";

  const safeLocal =
    localPart.length <= 2
      ? `${localPart[0] ?? "*"}*`
      : `${localPart.slice(0, 2)}***`;

  return domain ? `${safeLocal}@${domain}` : safeLocal;
}

export function createAccountDeletionToken(
  payload: DeletionTokenPayload,
  secret?: string
) {
  const signingSecret = getTokenSecret(secret);
  if (!signingSecret) {
    throw new Error("NEXTAUTH_SECRET is required to sign account deletion tokens");
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", signingSecret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyAccountDeletionToken(token: string, secret?: string) {
  const signingSecret = getTokenSecret(secret);
  if (!signingSecret) {
    throw new Error("NEXTAUTH_SECRET is required to verify account deletion tokens");
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Malformed account deletion token");
  }

  const expectedSignature = crypto
    .createHmac("sha256", signingSecret)
    .update(encodedPayload)
    .digest("base64url");

  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    throw new Error("Invalid account deletion token signature");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as DeletionTokenPayload;
  if (!payload.userId || !payload.requestId || !payload.exp) {
    throw new Error("Malformed account deletion token payload");
  }

  if (payload.exp < Date.now()) {
    throw new Error("Account deletion token expired");
  }

  return payload;
}

export function extractStorageKeyFromUrl(fileUrl: string | null | undefined) {
  if (!fileUrl) return null;

  try {
    const parsed = new URL(fileUrl);
    const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    const endpoint = process.env.R2_ENDPOINT?.replace(/\/$/, "");
    const bucket = process.env.R2_BUCKET_NAME;

    if (publicUrl && fileUrl.startsWith(`${publicUrl}/`)) {
      return fileUrl.slice(publicUrl.length + 1);
    }

    if (endpoint && bucket) {
      const bucketPrefix = `${endpoint}/${bucket}/`;
      if (fileUrl.startsWith(bucketPrefix)) {
        return fileUrl.slice(bucketPrefix.length);
      }
    }

    const pathname = parsed.pathname.replace(/^\/+/, "");
    if (!pathname) return null;

    if (bucket && pathname.startsWith(`${bucket}/`)) {
      return pathname.slice(bucket.length + 1);
    }

    return null;
  } catch {
    return null;
  }
}
