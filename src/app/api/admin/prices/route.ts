import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  // Check authentication
  const auth = await checkAdminAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const form = await req.formData();
  const staffId = String(form.get("staffId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  const priceCents = Number(form.get("priceCents") ?? 0);
  const currency = String(form.get("currency") ?? "EUR").toUpperCase();

  if (!staffId || !serviceId || !priceCents) {
    return NextResponse.json({ ok: false, error: { code: "BAD_INPUT", message: "Missing fields" } }, { status: 400 });
  }

  await db.serviceStaffPrice.upsert({
    where: { serviceId_staffId: { serviceId, staffId } },
    create: { serviceId, staffId, priceCents, currency },
    update: { priceCents, currency },
  });

  revalidatePath("/admin/staff");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { staffId, serviceId } = await req.json();
  if (!staffId || !serviceId) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_INPUT", message: "Missing fields" } },
      { status: 400 }
    );
  }

  await db.serviceStaffPrice.delete({
    where: { serviceId_staffId: { serviceId, staffId } },
  });

  revalidatePath("/admin/staff");
  return NextResponse.json({ ok: true });
}
