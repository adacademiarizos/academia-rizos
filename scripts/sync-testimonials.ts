import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

type TestimonialType = "SALON" | "ACADEMIA";

type SourceTestimonialRow = {
  id: string;
  name: string;
  role: string | null;
  quote: string;
  stars: number | null;
  avatarUrl: string | null;
  isActive: boolean | null;
  order: number | null;
  type?: string | null;
};

function parseArg(name: string): string | null {
  const full = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!full) return null;
  return full.slice(name.length + 3);
}

function loadEnvFile(filePath: string) {
  const abs = path.resolve(filePath);
  if (!existsSync(abs)) return {};
  return dotenv.parse(readFileSync(abs));
}

function inferType(row: SourceTestimonialRow): TestimonialType {
  const role = (row.role ?? "").toLowerCase();
  const quote = (row.quote ?? "").toLowerCase();
  const academiaSignals = [
    "alumna",
    "academia",
    "curso",
    "formacion",
    "certific",
  ];

  const hasAcademiaSignal = academiaSignals.some(
    (token) => role.includes(token) || quote.includes(token)
  );

  return hasAcademiaSignal ? "ACADEMIA" : "SALON";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sourceEnvFile = parseArg("source-env") ?? ".env.production";
  const targetEnvFile = parseArg("target-env") ?? ".env";
  const sourceUrlArg = parseArg("source-url");
  const targetUrlArg = parseArg("target-url");
  const localEnv = loadEnvFile(targetEnvFile);
  const sourceEnv = loadEnvFile(sourceEnvFile);

  const targetUrl = targetUrlArg ?? localEnv.DATABASE_URL;
  const sourceUrl = sourceUrlArg ?? sourceEnv.DATABASE_URL;

  if (!targetUrl) {
    throw new Error(`No se encontro DATABASE_URL en ${targetEnvFile}`);
  }

  if (!sourceUrl) {
    throw new Error(`No se encontro DATABASE_URL en ${sourceEnvFile}`);
  }

  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  const target = new PrismaClient({ datasources: { db: { url: targetUrl } } });

  try {
    const sourceTables = await source.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const sourceTableNames = new Set(sourceTables.map((t) => t.table_name));
    const sourceTable =
      ["Testimonial", "testimonial", "testimonials"].find((name) =>
        sourceTableNames.has(name)
      ) ?? null;

    if (!sourceTable) {
      const similar = [...sourceTableNames].filter((name) =>
        name.toLowerCase().includes("test")
      );
      throw new Error(
        `La base origen no tiene tabla de testimonios (busque: Testimonial/testimonial/testimonials). Tablas parecidas: ${similar.join(", ") || "ninguna"}`
      );
    }

    const sourceHasTypeRows = await source.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '${sourceTable}'
          AND column_name = 'type'
      ) AS "exists"`
    );
    const sourceHasType = Boolean(sourceHasTypeRows[0]?.exists);

    const selectSql = sourceHasType
      ? `SELECT id, name, role, quote, stars, "avatarUrl", "isActive", "order", type FROM "${sourceTable}" ORDER BY "order" ASC, "createdAt" ASC`
      : `SELECT id, name, role, quote, stars, "avatarUrl", "isActive", "order" FROM "${sourceTable}" ORDER BY "order" ASC, "createdAt" ASC`;

    const sourceRows = await source.$queryRawUnsafe<SourceTestimonialRow[]>(
      selectSql
    );

    if (sourceRows.length === 0) {
      console.log("No hay testimonios en la base origen.");
      return;
    }

    const normalized = sourceRows.map((row, index) => {
      const explicitType = row.type === "SALON" || row.type === "ACADEMIA" ? row.type : null;
      return {
        id: row.id,
        name: row.name,
        role: row.role ?? "Clienta",
        quote: row.quote,
        stars: Math.max(1, Math.min(5, Number(row.stars ?? 5))),
        avatarUrl: row.avatarUrl ?? null,
        isActive: row.isActive ?? true,
        order: Number.isFinite(row.order as number) ? Number(row.order) : index,
        type: (explicitType ?? inferType(row)) as TestimonialType,
      };
    });

    const salonCount = normalized.filter((t) => t.type === "SALON").length;
    const academiaCount = normalized.filter((t) => t.type === "ACADEMIA").length;

    console.log(
      `Origen: ${sourceRows.length} testimonios (SALON=${salonCount}, ACADEMIA=${academiaCount})`
    );

    if (dryRun) {
      console.log("Dry run activado. No se escribio en la base local.");
      return;
    }

    await target.$transaction([
      target.testimonial.deleteMany({}),
      target.testimonial.createMany({ data: normalized }),
    ]);

    const targetCount = await target.testimonial.count();
    console.log(`Destino actualizado: ${targetCount} testimonios en local.`);
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error("Error sincronizando testimonios:", error);
  process.exit(1);
});
