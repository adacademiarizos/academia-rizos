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
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (!name || !email) {
    return NextResponse.json({ ok: false, error: { code: "BAD_INPUT", message: "Missing fields" } }, { status: 400 });
  }

  await db.user.upsert({
    where: { email },
    create: { name, email, role: "STAFF" },
    update: { name, role: "STAFF" },
  });

  return NextResponse.redirect(new URL("/admin/staff", req.url));
}
