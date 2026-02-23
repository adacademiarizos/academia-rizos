import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function POST(req: Request) {
  // Check authentication
  const auth = await checkAdminAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");

  if (!id || !status) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_INPUT", message: "Missing fields" } },
      { status: 400 }
    );
  }

  await db.appointment.update({
    where: { id },
    data: { status: status as any },
  });

  return NextResponse.redirect(new URL("/admin/appointments", req.url));
}
