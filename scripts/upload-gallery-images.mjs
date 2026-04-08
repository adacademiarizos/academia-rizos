/**
 * Script to upload images from a local folder to the Gallery (ResultImage) in production.
 * Uses production env vars from .env.production, sharp for dimensions, and AWS SDK for R2.
 *
 * Usage:
 *   node scripts/upload-gallery-images.mjs <folder_path>
 */

import { readFileSync, readdirSync } from "fs";
import { join, extname, basename } from "path";
import { createRequire } from "module";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

// Load production env
dotenv.config({ path: ".env.production" });

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".webp"];

const imagesFolder =
  process.argv[2] ??
  "C:\\Users\\ramse\\Documents\\Proyectos\\Desarrollo\\Elizabeth\\Data proporcionada\\modelos";

async function main() {
  // Validate env vars
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL, DATABASE_URL } = process.env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error("Missing R2 environment variables in .env.production");
  }
  if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in .env.production");
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

  // List image files
  const files = readdirSync(imagesFolder).filter((f) =>
    ALLOWED_EXTS.includes(extname(f).toLowerCase())
  );

  if (files.length === 0) {
    console.log("No image files found in:", imagesFolder);
    return;
  }

  console.log(`Found ${files.length} images. Uploading to production...`);

  // Get current max order from DB
  const maxOrder = await db.resultImage.aggregate({ _max: { order: true } });
  let nextOrder = (maxOrder._max.order ?? -1) + 1;

  for (const file of files) {
    const filePath = join(imagesFolder, file);
    const buffer = readFileSync(filePath);
    const ext = extname(file).slice(1).toLowerCase();
    const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;

    // Get dimensions
    const meta = await sharp(buffer).metadata();
    const width = meta.width;
    const height = meta.height;
    if (!width || !height) {
      console.warn(`  ⚠ Skipping ${file}: could not read dimensions`);
      continue;
    }
    const aspectRatio = width / height;

    // Upload to R2
    const ts = Date.now();
    const rnd = Math.random().toString(36).substring(7);
    const key = `results/${ts}-${rnd}.${ext === "jpeg" ? "jpeg" : ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicBase = R2_PUBLIC_URL ?? R2_ENDPOINT;
    const url = `${publicBase.replace(/\/$/, "")}/${R2_PUBLIC_URL ? key : `${R2_BUCKET_NAME}/${key}`}`;

    // Insert into DB
    const record = await db.resultImage.create({
      data: {
        url,
        label: null,
        aspectRatio,
        width,
        height,
        order: nextOrder++,
      },
    });

    console.log(`  ✓ ${file} → ${record.id} (${width}×${height})`);
  }

  await db.$disconnect();
  console.log(`\nDone. ${files.length} images uploaded.`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
