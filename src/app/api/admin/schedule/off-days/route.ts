import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const { date, reason } = body as { date?: string; reason?: string };

  if (!date) {
    return NextResponse.json(
      { ok: false, error: { code: "MISSING_DATE", message: "date is required" } },
      { status: 400 }
    );
  }

  const [y, mo, d] = date.split("-").map(Number);
  const dateObj = new Date(y, mo - 1, d);

  const offDay = await db.businessOffDay.create({
    data: { date: dateObj, reason: reason?.trim() || null },
  });

  revalidatePath("/");
  revalidatePath("/horarios");
  return NextResponse.json({ ok: true, data: offDay }, { status: 201 });
}

export async function DELETE(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { ok: false, error: { code: "MISSING_ID", message: "id is required" } },
      { status: 400 }
    );
  }

  await db.businessOffDay.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/horarios");
  return NextResponse.json({ ok: true });
}
