import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string; variantId: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { variantId } = await ctx.params;
  const body = await req.json();

  const variant = await db.serviceVariant.update({
    where: { id: variantId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.durationMin !== undefined && { durationMin: body.durationMin }),
      ...(body.order !== undefined && { order: body.order }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json({ ok: true, data: variant });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; variantId: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { variantId } = await ctx.params;

  await db.variantStaffPrice.deleteMany({ where: { variantId } });
  await db.serviceVariant.delete({ where: { id: variantId } });

  return NextResponse.json({ ok: true });
}
