import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const settings = await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });

  return NextResponse.json({ success: true, data: settings });
}

export async function POST(req: Request) {
  // Check authentication
  const auth = await checkAdminAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const form = await req.formData();
  const feePercent = Number(form.get("feePercent") ?? 2.5);
  const feeFixedCents = Number(form.get("feeFixedCents") ?? 25);
  const defaultCurrency = String(form.get("defaultCurrency") ?? "EUR").toUpperCase();

  await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global", feePercent, feeFixedCents, defaultCurrency },
    update: { feePercent, feeFixedCents, defaultCurrency },
  });

  return NextResponse.redirect(new URL("/admin/settings", req.url));
}
