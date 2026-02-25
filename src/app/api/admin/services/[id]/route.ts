import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { z } from "zod";

const UpdateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  durationMin: z.number().int().positive().optional(),
  billingRule: z.enum(["FULL", "DEPOSIT", "AUTHORIZE"]).optional(),
  depositPct: z.number().int().min(1).max(100).optional().nullable(),
});

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await ctx.params;
  const body = await req.json();
  const data = UpdateServiceSchema.parse(body);

  const service = await db.service.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.durationMin !== undefined && { durationMin: data.durationMin }),
      ...(data.billingRule !== undefined && { billingRule: data.billingRule as any }),
      ...(data.depositPct !== undefined && { depositPct: data.depositPct }),
    },
  });

  return NextResponse.json({ ok: true, data: service });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await ctx.params;

  // Delete related prices first to avoid FK constraint violation
  await db.serviceStaffPrice.deleteMany({ where: { serviceId: id } });
  await db.service.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
