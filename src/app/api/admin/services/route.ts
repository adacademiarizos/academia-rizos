import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

const serviceInclude = {
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    orderBy: { order: "asc" as const },
    select: { id: true, name: true, durationMin: true, order: true, isActive: true },
  },
};

export async function GET(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const services = await db.service.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    include: serviceInclude,
  });
  return NextResponse.json({ ok: true, data: services });
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const durationMin = body.durationMin != null ? Number(body.durationMin) : null;
  const billingRule = String(body.billingRule ?? "FULL");
  const depositPct = body.depositPct != null ? Number(body.depositPct) : null;
  const categoryId = body.categoryId || null;
  const isActive = body.isActive !== false;
  const order = typeof body.order === "number" ? body.order : 0;

  if (!name) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_INPUT", message: "Name is required" } },
      { status: 400 }
    );
  }

  const service = await db.service.create({
    data: {
      name,
      description: description || null,
      durationMin,
      billingRule: billingRule as any,
      depositPct: billingRule === "DEPOSIT" ? (depositPct || 50) : null,
      categoryId,
      isActive,
      order,
    },
    include: serviceInclude,
  });

  return NextResponse.json({ ok: true, data: service }, { status: 201 });
}
