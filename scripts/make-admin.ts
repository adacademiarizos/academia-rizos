import { db } from "../src/lib/db";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: ts-node scripts/make-admin.ts email@domain.com");

  await db.user.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), role: "ADMIN" },
    update: { role: "ADMIN" },
  });

  console.log("OK admin:", email);
}

main().finally(() => process.exit(0));
