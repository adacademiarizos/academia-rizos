import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function GET() {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const categories = await db.serviceCategory.findMany({
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ ok: true, data: categories });
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_INPUT", message: "Name is required" } },
      { status: 400 }
    );
  }

  const slug =
    body.slug?.trim() ||
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const category = await db.serviceCategory.create({
    data: {
      name,
      slug,
      order: typeof body.order === "number" ? body.order : 0,
    },
  });

  return NextResponse.json({ ok: true, data: category }, { status: 201 });
}
