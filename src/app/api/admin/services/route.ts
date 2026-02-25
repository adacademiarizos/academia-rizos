import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const services = await db.service.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ok: true, data: services });
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const durationMin = Number(form.get("durationMin") ?? 0);
  const billingRule = String(form.get("billingRule") ?? "FULL");
  const depositPctRaw = form.get("depositPct");
  const depositPct = depositPctRaw ? Number(depositPctRaw) : null;

  if (!name || !durationMin) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_INPUT", message: "Missing fields" } },
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
    },
  });

  return NextResponse.json({ ok: true, data: service }, { status: 201 });
}
