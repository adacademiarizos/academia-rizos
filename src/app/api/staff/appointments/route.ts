import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkStaffAuth } from "@/lib/staff-auth";

export async function GET(req: Request) {
  const auth = await checkStaffAuth();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const upcoming = searchParams.get("upcoming") === "true";

  const where: any = { staffId: auth.user.id };
  if (status) where.status = status;
  if (upcoming) where.startAt = { gte: new Date() };

  const appointments = await db.appointment.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: {
      service: { select: { name: true, durationMin: true } },
      customer: { select: { id: true, name: true, email: true, image: true } },
      payments: { select: { id: true, status: true, amountCents: true, currency: true } },
    },
  });

  return NextResponse.json({ ok: true, data: appointments });
}
