import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ContactScope = "ACADEMIA" | "SALON";

export type ContactContent = {
  sectionKicker: string;
  sectionTitle: string;
  sectionDescription: string;
  instagramUrl: string;
  instagramHandle: string;
  tiktokUrl: string;
  tiktokHandle: string;
  facebookUrl: string;
  facebookHandle: string;
  whatsappUrl: string;
  whatsappLabel: string;
  emailPrimaryLabel: string;
  emailPrimary: string;
  emailSecondaryLabel: string;
  emailSecondary: string;
  actionLabel: string;
  actionHref: string;
  locationTitle: string;
  address: string;
  scheduleLine1: string;
  scheduleLine2: string;
  scheduleLine3: string;
  mapsUrl: string;
};

const BASE_DEFAULTS: ContactContent = {
  sectionKicker: "Contacto",
  sectionTitle: "Estamos aquí para ti",
  sectionDescription:
    "Puedes contactarnos a través de nuestras redes sociales, por correo electrónico o visitar nuestro estudio físico.",
  instagramUrl: "https://www.instagram.com/elizabeth.rizos",
  instagramHandle: "@elizabeth.rizos",
  tiktokUrl: "https://www.tiktok.com/@elizabeth.rizos",
  tiktokHandle: "@elizabeth.rizos",
  facebookUrl: "https://www.facebook.com/elizabethrizos",
  facebookHandle: "elizabeth rizos",
  whatsappUrl: "https://wa.me/34600000000",
  whatsappLabel: "Escríbenos directamente",
  emailPrimaryLabel: "Consultas generales",
  emailPrimary: "hola@apoteosicas.com",
  emailSecondaryLabel: "Academia y cursos",
  emailSecondary: "academia@apoteosicas.com",
  actionLabel: "Reservar cita online",
  actionHref: "/booking",
  locationTitle: "Nuestro Estudio",
  address: "Calle Ejemplo, 123\n28001 Madrid, España",
  scheduleLine1: "Lunes - Viernes: 10:00 - 20:00",
  scheduleLine2: "Sábado: 10:00 - 15:00",
  scheduleLine3: "Domingo: Cerrado",
  mapsUrl: "https://maps.google.com",
};

export const CONTACT_DEFAULTS: Record<ContactScope, ContactContent> = {
  ACADEMIA: {
    ...BASE_DEFAULTS,
    sectionKicker: "Contacto academia",
    sectionTitle: "Estamos aquí para acompañarte",
    sectionDescription:
      "Escríbenos por correo o WhatsApp para dudas sobre cursos, acceso, certificaciones y soporte de la plataforma.",
    emailSecondaryLabel: "Soporte academia",
    emailSecondary: "academia@apoteosicas.com",
    actionLabel: "Explorar cursos",
    actionHref: "/courses",
    locationTitle: "Academia online",
    address: "Academia digital.\nSoporte desde Palma de Mallorca.",
    scheduleLine1: "Lunes - Viernes: 09:00 - 18:00",
    scheduleLine2: "Sábado: soporte reducido",
    scheduleLine3: "Domingo: cerrado",
  },
  SALON: {
    ...BASE_DEFAULTS,
    sectionKicker: "Contacto salón",
    sectionTitle: "Reserva y atención personalizada",
    sectionDescription:
      "Si quieres cita para el salón, escríbenos por WhatsApp o reserva directamente en Booksy.",
    emailSecondaryLabel: "Reservas salón",
    emailSecondary: "hola@apoteosicas.com",
    actionLabel: "Reservar en Booksy",
    actionHref:
      "https://booksy.com/es-es/115013_apoteosicas-by-elizabeth-rizos-salon_peluqueria_69069_palma-de-mallorca",
    locationTitle: "Salón Apoteósicas",
    address: "Carretera de Valldemossa, 33\n07010 Palma, Illes Balears",
  },
};

export const CONTACT_CONTENT_MIGRATION_MESSAGE =
  'La base de datos no tiene la tabla ContactContent. Ejecuta "npx prisma migrate deploy".';

let hasContactContentTableCache: boolean | null = null;

function normalizeString(
  value: unknown,
  fallback: string,
  options?: { maxLength?: number; allowEmpty?: boolean }
) {
  if (typeof value !== "string") return fallback;
  const maxLength = options?.maxLength ?? 500;
  const allowEmpty = options?.allowEmpty ?? false;
  const trimmed = value.trim().slice(0, maxLength);
  if (!allowEmpty && trimmed.length === 0) return fallback;
  return trimmed;
}

export function normalizeContactContent(
  value: Partial<Record<keyof ContactContent, unknown>>,
  fallback: ContactContent
): ContactContent {
  return {
    sectionKicker: normalizeString(value.sectionKicker, fallback.sectionKicker, { maxLength: 80 }),
    sectionTitle: normalizeString(value.sectionTitle, fallback.sectionTitle, { maxLength: 160 }),
    sectionDescription: normalizeString(value.sectionDescription, fallback.sectionDescription, {
      maxLength: 500,
    }),
    instagramUrl: normalizeString(value.instagramUrl, fallback.instagramUrl, { maxLength: 500 }),
    instagramHandle: normalizeString(value.instagramHandle, fallback.instagramHandle, { maxLength: 120 }),
    tiktokUrl: normalizeString(value.tiktokUrl, fallback.tiktokUrl, { maxLength: 500 }),
    tiktokHandle: normalizeString(value.tiktokHandle, fallback.tiktokHandle, { maxLength: 120 }),
    facebookUrl: normalizeString(value.facebookUrl, fallback.facebookUrl, { maxLength: 500 }),
    facebookHandle: normalizeString(value.facebookHandle, fallback.facebookHandle, { maxLength: 120 }),
    whatsappUrl: normalizeString(value.whatsappUrl, fallback.whatsappUrl, { maxLength: 500 }),
    whatsappLabel: normalizeString(value.whatsappLabel, fallback.whatsappLabel, { maxLength: 140 }),
    emailPrimaryLabel: normalizeString(value.emailPrimaryLabel, fallback.emailPrimaryLabel, {
      maxLength: 140,
    }),
    emailPrimary: normalizeString(value.emailPrimary, fallback.emailPrimary, { maxLength: 160 }),
    emailSecondaryLabel: normalizeString(value.emailSecondaryLabel, fallback.emailSecondaryLabel, {
      maxLength: 140,
    }),
    emailSecondary: normalizeString(value.emailSecondary, fallback.emailSecondary, { maxLength: 160 }),
    actionLabel: normalizeString(value.actionLabel, fallback.actionLabel, {
      maxLength: 100,
      allowEmpty: true,
    }),
    actionHref: normalizeString(value.actionHref, fallback.actionHref, {
      maxLength: 500,
      allowEmpty: true,
    }),
    locationTitle: normalizeString(value.locationTitle, fallback.locationTitle, { maxLength: 120 }),
    address: normalizeString(value.address, fallback.address, { maxLength: 400 }),
    scheduleLine1: normalizeString(value.scheduleLine1, fallback.scheduleLine1, {
      maxLength: 120,
      allowEmpty: true,
    }),
    scheduleLine2: normalizeString(value.scheduleLine2, fallback.scheduleLine2, {
      maxLength: 120,
      allowEmpty: true,
    }),
    scheduleLine3: normalizeString(value.scheduleLine3, fallback.scheduleLine3, {
      maxLength: 120,
      allowEmpty: true,
    }),
    mapsUrl: normalizeString(value.mapsUrl, fallback.mapsUrl, { maxLength: 500, allowEmpty: true }),
  };
}

function isMissingTableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021";
  }
  return false;
}

async function hasContactContentTable() {
  if (hasContactContentTableCache !== null) return hasContactContentTableCache;

  try {
    const rows = await db.$queryRaw<Array<{ exists: boolean }>>(
      Prisma.sql`SELECT to_regclass('public."ContactContent"') IS NOT NULL AS "exists"`
    );
    hasContactContentTableCache = Boolean(rows[0]?.exists);
    return hasContactContentTableCache;
  } catch {
    // If metadata query fails, continue with normal flow.
    hasContactContentTableCache = true;
    return true;
  }
}

export async function getContactContent(scope: ContactScope): Promise<ContactContent> {
  const tableExists = await hasContactContentTable();
  if (!tableExists) return CONTACT_DEFAULTS[scope];

  try {
    const row = await db.contactContent.findUnique({ where: { id: scope } });
    if (!row) return CONTACT_DEFAULTS[scope];
    return normalizeContactContent(row, CONTACT_DEFAULTS[scope]);
  } catch (error) {
    if (isMissingTableError(error)) return CONTACT_DEFAULTS[scope];
    console.error("Error loading ContactContent:", error);
    return CONTACT_DEFAULTS[scope];
  }
}

export async function getAllContactContent() {
  const [academia, salon] = await Promise.all([
    getContactContent("ACADEMIA"),
    getContactContent("SALON"),
  ]);
  return { academia, salon };
}

export async function upsertContactContent(
  scope: ContactScope,
  value: Partial<Record<keyof ContactContent, unknown>>
): Promise<ContactContent> {
  const tableExists = await hasContactContentTable();
  if (!tableExists) {
    throw new Error(CONTACT_CONTENT_MIGRATION_MESSAGE);
  }

  const current = await getContactContent(scope);
  const payload = normalizeContactContent(value, current);

  try {
    const row = await db.contactContent.upsert({
      where: { id: scope },
      create: { id: scope, ...payload },
      update: payload,
    });
    return normalizeContactContent(row, CONTACT_DEFAULTS[scope]);
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error(CONTACT_CONTENT_MIGRATION_MESSAGE);
    }
    throw error;
  }
}

export async function upsertAllContactContent(value: {
  academia?: Partial<Record<keyof ContactContent, unknown>>;
  salon?: Partial<Record<keyof ContactContent, unknown>>;
}) {
  const [academia, salon] = await Promise.all([
    upsertContactContent("ACADEMIA", value.academia ?? {}),
    upsertContactContent("SALON", value.salon ?? {}),
  ]);
  return { academia, salon };
}
