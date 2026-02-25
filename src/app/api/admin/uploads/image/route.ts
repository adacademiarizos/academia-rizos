/**
 * POST /api/admin/uploads/image — Upload an image to R2 and return its public URL.
 * Used for course thumbnails and other admin image uploads.
 */

import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { uploadFile } from "@/lib/storage";
import { nanoid } from "nanoid";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const form = await req.formData();
  const file = form.get("image") as File | null;

  if (!file) {
    return NextResponse.json(
      { ok: false, error: { code: "NO_FILE", message: "No image provided" } },
      { status: 400 }
    );
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_TYPE", message: "Only JPEG, PNG, WebP or GIF accepted" } },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { ok: false, error: { code: "TOO_LARGE", message: "Max 5 MB per image" } },
      { status: 413 }
    );
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const key = `images/${nanoid()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const url = await uploadFile(key, buffer, file.type);

  return NextResponse.json({ ok: true, data: { url } });
}
