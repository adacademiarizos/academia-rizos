import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await ctx.params;
  const variants = await db.serviceVariant.findMany({
    where: { serviceId: id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ ok: true, data: variants });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await ctx.params;
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const durationMin = Number(body.durationMin ?? 0);

  if (!name || !durationMin) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_INPUT", message: "name and durationMin are required" } },
      { status: 400 }
    );
  }

  const variant = await db.serviceVariant.create({
    data: {
      serviceId: id,
      name,
      durationMin,
      order: typeof body.order === "number" ? body.order : 0,
    },
  });

  return NextResponse.json({ ok: true, data: variant }, { status: 201 });
}
