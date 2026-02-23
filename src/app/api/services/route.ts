import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const services = await db.service.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      durationMin: true,
      billingRule: true,
      depositPct: true,
      imageUrls: true,
    },
  });

  return NextResponse.json({ ok: true, data: { services } });
}
