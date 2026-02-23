import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  const body = await req.json();
  const { role } = body;

  if (!["ADMIN", "STAFF", "STUDENT"].includes(role)) {
    return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });
  }

  // Prevent self-demotion (admin can't change their own role)
  if (id === auth.user.id) {
    return NextResponse.json(
      { ok: false, error: "No puedes cambiar tu propio rol" },
      { status: 400 }
    );
  }

  const user = await db.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ ok: true, data: user });
}
