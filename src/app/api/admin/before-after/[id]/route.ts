import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await ctx.params;

  const pair = await db.beforeAfterPair.findUnique({ where: { id } });
  if (!pair) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Par no encontrado" } },
      { status: 404 }
    );
  }

  await db.beforeAfterPair.delete({ where: { id } });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
