import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ serviceId: string }> }
) {
  const { serviceId } = await ctx.params;

  const prices = await db.serviceStaffPrice.findMany({
    where: { serviceId },
    include: {
      staff: {
        include: { staffProfile: { select: { photoUrl: true } } },
      },
    },
  });

  const map = new Map<
    string,
    { staffId: string; name: string; priceCents: number; currency: string; photoUrl: string | null }
  >();

  for (const p of prices) {
    if (!map.has(p.staffId)) {
      map.set(p.staffId, {
        staffId: p.staffId,
        name: p.staff.name ?? p.staff.email,
        priceCents: p.priceCents,
        currency: p.currency,
        photoUrl: p.staff.staffProfile?.photoUrl ?? p.staff.image ?? null,
      });
    }
  }

  return NextResponse.json({ ok: true, data: { staff: Array.from(map.values()) } });
}
