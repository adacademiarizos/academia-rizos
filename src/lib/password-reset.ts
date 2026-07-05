import crypto from "crypto";
import { z } from "zod";

export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_EMAIL_LIMIT = 3;
export const PASSWORD_RESET_IP_LIMIT = 5;
export const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "Si el email existe, te enviamos instrucciones para restablecer tu contrasena.";
export const INVALID_RESET_PASSWORD_MESSAGE =
  "Enlace invalido o expirado.";
export const PASSWORD_RESET_SUCCESS_MESSAGE =
  "Contrasena actualizada. Inicia sesion con tu nueva clave.";

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Email invalido"),
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "El token es requerido"),
    password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
    confirmPassword: z.string().min(8, "Confirma tu contrasena").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Las contrasenas no coinciden",
        path: ["confirmPassword"],
      });
    }
  });

export function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken(now = new Date()) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS);

  return { token, tokenHash, expiresAt };
}

export function getPasswordResetWindowStart(now = new Date()) {
  return new Date(now.getTime() - PASSWORD_RESET_RATE_LIMIT_WINDOW_MS);
}

export function isSessionVersionStale(
  tokenSessionVersion: unknown,
  currentSessionVersion: number
) {
  const normalizedTokenVersion =
    typeof tokenSessionVersion === "number" && Number.isFinite(tokenSessionVersion)
      ? tokenSessionVersion
      : 0;

  return normalizedTokenVersion !== currentSessionVersion;
}

export function getRequestIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return null;
}
