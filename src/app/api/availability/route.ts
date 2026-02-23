import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildSlotsForDay(day: Date, stepMin: number) {
  const slots: Date[] = [];
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);

  const startHour = 9;
  const endHour = 18;

  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      const x = new Date(d);
      x.setHours(h, m, 0, 0);
      slots.push(x);
    }
  }
  return slots;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("serviceId") ?? "";
    const staffId = url.searchParams.get("staffId") ?? "";
    const dateParam = url.searchParams.get("date"); // YYYY-MM-DD (optional)

    if (!serviceId || !staffId) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_PARAMS", message: "serviceId and staffId are required" } },
        { status: 400 }
      );
    }

    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { durationMin: true, isActive: true },
    });

    if (!service || !service.isActive) {
      return NextResponse.json(
        { ok: false, error: { code: "SERVICE_NOT_FOUND", message: "Service not found" } },
        { status: 404 }
      );
    }

    const durationMin = service.durationMin ?? 30;
    const stepMin = 30;

    let slots: Date[];

    if (dateParam) {
      // Generate slots for a specific date
      const [y, mo, d] = dateParam.split("-").map(Number);
      const targetDay = new Date(y, mo - 1, d);
      slots = buildSlotsForDay(targetDay, stepMin);
    } else {
      // Legacy: next 2 days
      const now = new Date();
      const d1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const d2 = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      slots = [...buildSlotsForDay(d1, stepMin), ...buildSlotsForDay(d2, stepMin)];
    }

    // Fetch appointments that overlap with our slot range
    const rangeStart = slots[0];
    const rangeEnd = new Date(slots[slots.length - 1].getTime() + durationMin * 60 * 1000);

    const appointments = await db.appointment.findMany({
      where: {
        staffId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { lt: rangeEnd },
        endAt: { gt: rangeStart },
      },
      select: { startAt: true, endAt: true },
    });

    const available = slots
      .filter((s) => s.getTime() > Date.now())
      .filter((candidateStart) => {
        const candidateEnd = new Date(candidateStart.getTime() + durationMin * 60 * 1000);
        const overlaps = appointments.some(
          (a) => a.startAt < candidateEnd && a.endAt > candidateStart
        );
        return !overlaps;
      })
      .map((d) => d.toISOString());

    return NextResponse.json({ ok: true, data: { slots: available } });
  } catch (err: any) {
    console.error("AVAILABILITY ERROR:", err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: { code: "AVAILABILITY_ERROR", message: err?.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}
