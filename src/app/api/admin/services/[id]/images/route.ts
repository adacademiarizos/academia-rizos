import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { checkAdminAuth } from "@/lib/admin-auth";

const MAX_IMAGES = 3;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id: serviceId } = await ctx.params;

  const service = await db.service.findUnique({
    where: { id: serviceId },
    select: { imageUrls: true },
  });
  if (!service) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Service not found" } },
      { status: 404 }
    );
  }

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
      { ok: false, error: { code: "INVALID_TYPE", message: "Only JPEG, PNG or WebP accepted" } },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { ok: false, error: { code: "TOO_LARGE", message: "Max 5MB per image" } },
      { status: 400 }
    );
  }

  if (service.imageUrls.length >= MAX_IMAGES) {
    return NextResponse.json(
      { ok: false, error: { code: "MAX_IMAGES", message: `Maximum ${MAX_IMAGES} images per service` } },
      { status: 400 }
    );
  }

  const ext = file.type.split("/")[1] ?? "jpg";
  const key = `services/${serviceId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadFile(key, buffer, file.type);

  const updated = await db.service.update({
    where: { id: serviceId },
    data: { imageUrls: { push: url } },
    select: { imageUrls: true },
  });

  return NextResponse.json({ ok: true, data: { imageUrls: updated.imageUrls } });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id: serviceId } = await ctx.params;
  const url = new URL(req.url).searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { ok: false, error: { code: "NO_URL", message: "url query param required" } },
      { status: 400 }
    );
  }

  const service = await db.service.findUnique({
    where: { id: serviceId },
    select: { imageUrls: true },
  });
  if (!service) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Service not found" } },
      { status: 404 }
    );
  }

  const updated = await db.service.update({
    where: { id: serviceId },
    data: { imageUrls: service.imageUrls.filter((u) => u !== url) },
    select: { imageUrls: true },
  });

  return NextResponse.json({ ok: true, data: { imageUrls: updated.imageUrls } });
}
