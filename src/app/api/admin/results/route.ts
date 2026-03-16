import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { checkAdminAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function GET() {
  const images = await db.resultImage.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ ok: true, data: images });
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const label = (form.get("label") as string | null) ?? null;
  const width = parseInt(form.get("width") as string, 10);
  const height = parseInt(form.get("height") as string, 10);
  const aspectRatio = parseFloat(form.get("aspectRatio") as string);

  if (!file) {
    return NextResponse.json(
      { ok: false, error: { code: "NO_FILE", message: "Se requiere una imagen" } },
      { status: 400 }
    );
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_TYPE", message: "Solo JPEG, PNG o WebP" } },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { ok: false, error: { code: "TOO_LARGE", message: "Máximo 10 MB" } },
      { status: 400 }
    );
  }

  if (isNaN(width) || isNaN(height) || isNaN(aspectRatio) || width <= 0 || height <= 0) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_DIMENSIONS", message: "Dimensiones inválidas" } },
      { status: 400 }
    );
  }

  const ts = Date.now();
  const rnd = Math.random().toString(36).substring(7);
  const ext = file.type.split("/")[1] ?? "jpg";

  const url = await uploadFile(
    `results/${ts}-${rnd}.${ext}`,
    Buffer.from(await file.arrayBuffer()),
    file.type
  );

  const maxOrder = await db.resultImage.aggregate({ _max: { order: true } });
  const order = (maxOrder._max.order ?? -1) + 1;

  const image = await db.resultImage.create({
    data: { url, label: label || null, aspectRatio, width, height, order },
  });

  revalidatePath("/");
  return NextResponse.json({ ok: true, data: image }, { status: 201 });
}
