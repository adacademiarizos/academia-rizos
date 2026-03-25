import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type AboutFounderContent = {
  kicker: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  imageAlt: string;
  quoteTitle: string;
  quoteBody: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
};

type AboutFounderRow = AboutFounderContent & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const ABOUT_FOUNDER_DEFAULTS: AboutFounderContent = {
  kicker: "Sobre Elizabeth",
  title: "Experiencia, tecnica y una comunidad que se siente",
  subtitle: "Un enfoque calido pero profesional. Aca va una bio corta y un CTA fuerte a reservas.",
  imageUrl: "/Elizabeth.webp",
  imageAlt: "Elizabeth Rizos",
  quoteTitle: 'Tu rizo no es "dificil", esta mal entendido.',
  quoteBody:
    "El objetivo no es solo que se vea bien hoy: es que tengas una rutina clara, productos adecuados y tecnica para mantener definicion, hidratacion y forma.",
  primaryCtaLabel: "Conocer el salon",
  primaryCtaHref: "/salon",
  secondaryCtaLabel: "Ver academia",
  secondaryCtaHref: "/academia",
};

export const ABOUT_FOUNDER_MIGRATION_MESSAGE =
  'La base de datos no tiene la tabla AboutFounderContent. Ejecuta "npx prisma migrate deploy".';

function normalizeString(
  value: unknown,
  fallback: string,
  options?: { maxLength?: number; allowEmpty?: boolean }
) {
  if (typeof value !== "string") return fallback;
  const maxLength = options?.maxLength ?? 600;
  const allowEmpty = options?.allowEmpty ?? false;
  const trimmed = value.trim().slice(0, maxLength);
  if (!allowEmpty && trimmed.length === 0) return fallback;
  return trimmed;
}

export function normalizeAboutFounderContent(
  value: Partial<Record<keyof AboutFounderContent, unknown>>,
  fallback: AboutFounderContent = ABOUT_FOUNDER_DEFAULTS
): AboutFounderContent {
  return {
    kicker: normalizeString(value.kicker, fallback.kicker, { maxLength: 120 }),
    title: normalizeString(value.title, fallback.title, { maxLength: 180 }),
    subtitle: normalizeString(value.subtitle, fallback.subtitle, { maxLength: 500 }),
    imageUrl: normalizeString(value.imageUrl, fallback.imageUrl, { maxLength: 500 }),
    imageAlt: normalizeString(value.imageAlt, fallback.imageAlt, { maxLength: 160, allowEmpty: true }),
    quoteTitle: normalizeString(value.quoteTitle, fallback.quoteTitle, { maxLength: 240 }),
    quoteBody: normalizeString(value.quoteBody, fallback.quoteBody, { maxLength: 900, allowEmpty: true }),
    primaryCtaLabel: normalizeString(value.primaryCtaLabel, fallback.primaryCtaLabel, {
      maxLength: 80,
      allowEmpty: true,
    }),
    primaryCtaHref: normalizeString(value.primaryCtaHref, fallback.primaryCtaHref, {
      maxLength: 500,
      allowEmpty: true,
    }),
    secondaryCtaLabel: normalizeString(value.secondaryCtaLabel, fallback.secondaryCtaLabel, {
      maxLength: 80,
      allowEmpty: true,
    }),
    secondaryCtaHref: normalizeString(value.secondaryCtaHref, fallback.secondaryCtaHref, {
      maxLength: 500,
      allowEmpty: true,
    }),
  };
}

function isMissingTableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const dbCode = String(error.meta?.code ?? "");
    if (dbCode === "42P01") return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("aboutfoundercontent") &&
      (message.includes("does not exist") || message.includes("relation"))
    ) {
      return true;
    }
  }

  return false;
}

export async function getAboutFounderContent(): Promise<AboutFounderContent> {
  try {
    const rows = await db.$queryRaw<AboutFounderRow[]>(Prisma.sql`
      SELECT
        "id",
        "kicker",
        "title",
        "subtitle",
        "imageUrl",
        "imageAlt",
        "quoteTitle",
        "quoteBody",
        "primaryCtaLabel",
        "primaryCtaHref",
        "secondaryCtaLabel",
        "secondaryCtaHref",
        "createdAt",
        "updatedAt"
      FROM "AboutFounderContent"
      WHERE "id" = 'global'
      LIMIT 1
    `);

    if (!rows[0]) return ABOUT_FOUNDER_DEFAULTS;
    return normalizeAboutFounderContent(rows[0], ABOUT_FOUNDER_DEFAULTS);
  } catch (error) {
    if (isMissingTableError(error)) return ABOUT_FOUNDER_DEFAULTS;
    console.error("Error loading AboutFounder content:", error);
    return ABOUT_FOUNDER_DEFAULTS;
  }
}

export async function upsertAboutFounderContent(
  value: Partial<Record<keyof AboutFounderContent, unknown>>
): Promise<AboutFounderContent> {
  const current = await getAboutFounderContent();
  const payload = normalizeAboutFounderContent(value, current);

  try {
    const rows = await db.$queryRaw<AboutFounderRow[]>(Prisma.sql`
      INSERT INTO "AboutFounderContent" (
        "id",
        "kicker",
        "title",
        "subtitle",
        "imageUrl",
        "imageAlt",
        "quoteTitle",
        "quoteBody",
        "primaryCtaLabel",
        "primaryCtaHref",
        "secondaryCtaLabel",
        "secondaryCtaHref"
      )
      VALUES (
        'global',
        ${payload.kicker},
        ${payload.title},
        ${payload.subtitle},
        ${payload.imageUrl},
        ${payload.imageAlt},
        ${payload.quoteTitle},
        ${payload.quoteBody},
        ${payload.primaryCtaLabel},
        ${payload.primaryCtaHref},
        ${payload.secondaryCtaLabel},
        ${payload.secondaryCtaHref}
      )
      ON CONFLICT ("id") DO UPDATE
      SET
        "kicker" = EXCLUDED."kicker",
        "title" = EXCLUDED."title",
        "subtitle" = EXCLUDED."subtitle",
        "imageUrl" = EXCLUDED."imageUrl",
        "imageAlt" = EXCLUDED."imageAlt",
        "quoteTitle" = EXCLUDED."quoteTitle",
        "quoteBody" = EXCLUDED."quoteBody",
        "primaryCtaLabel" = EXCLUDED."primaryCtaLabel",
        "primaryCtaHref" = EXCLUDED."primaryCtaHref",
        "secondaryCtaLabel" = EXCLUDED."secondaryCtaLabel",
        "secondaryCtaHref" = EXCLUDED."secondaryCtaHref",
        "updatedAt" = NOW()
      RETURNING
        "id",
        "kicker",
        "title",
        "subtitle",
        "imageUrl",
        "imageAlt",
        "quoteTitle",
        "quoteBody",
        "primaryCtaLabel",
        "primaryCtaHref",
        "secondaryCtaLabel",
        "secondaryCtaHref",
        "createdAt",
        "updatedAt"
    `);

    return normalizeAboutFounderContent(rows[0] ?? payload, ABOUT_FOUNDER_DEFAULTS);
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error(ABOUT_FOUNDER_MIGRATION_MESSAGE);
    }
    throw error;
  }
}
