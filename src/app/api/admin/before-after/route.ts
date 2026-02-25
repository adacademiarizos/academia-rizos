import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { checkAdminAuth } from "@/lib/admin-auth";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function GET() {
  const pairs = await db.beforeAfterPair.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ ok: true, data: pairs });
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const form = await req.formData();
  const beforeFile = form.get("before") as File | null;
  const afterFile  = form.get("after")  as File | null;
  const label      = (form.get("label") as string | null) ?? null;

  if (!beforeFile || !afterFile) {
    return NextResponse.json(
      { ok: false, error: { code: "NO_FILE", message: "Se requieren ambas imágenes (before y after)" } },
      { status: 400 }
    );
  }

  for (const [name, file] of [["before", beforeFile], ["after", afterFile]] as const) {
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_TYPE", message: `${name}: solo JPEG, PNG o WebP` } },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: { code: "TOO_LARGE", message: `${name}: máx. 10MB` } },
        { status: 400 }
      );
    }
  }

  const ts  = Date.now();
  const rnd = Math.random().toString(36).substring(7);

  const beforeExt = beforeFile.type.split("/")[1] ?? "jpg";
  const afterExt  = afterFile.type.split("/")[1]  ?? "jpg";

  const [beforeUrl, afterUrl] = await Promise.all([
    uploadFile(
      `before-after/${ts}-${rnd}-before.${beforeExt}`,
      Buffer.from(await beforeFile.arrayBuffer()),
      beforeFile.type
    ),
    uploadFile(
      `before-after/${ts}-${rnd}-after.${afterExt}`,
      Buffer.from(await afterFile.arrayBuffer()),
      afterFile.type
    ),
  ]);

  const maxOrder = await db.beforeAfterPair.aggregate({ _max: { order: true } });
  const order = (maxOrder._max.order ?? -1) + 1;

  const pair = await db.beforeAfterPair.create({
    data: { beforeUrl, afterUrl, label: label || null, order },
  });

  return NextResponse.json({ ok: true, data: pair }, { status: 201 });
}
