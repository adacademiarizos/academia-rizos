import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Build start-time slots for a day.
 * A slot is valid only if the entire service fits before closing time:
 *   slotStart + durationMin <= closeMinutes
 *
 * @param openMinutes  Minutes from midnight when the business opens (e.g. 10:00 → 600)
 * @param closeMinutes Minutes from midnight when the business closes (e.g. 18:00 → 1080)
 * @param stepMin      Service duration in minutes — slots are spaced this far apart
 */
function buildSlotsForDay(
  day: Date,
  stepMin: number,
  openMinutes: number,
  closeMinutes: number
): Date[] {
  const slots: Date[] = [];
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);

  for (let mins = openMinutes; mins + stepMin <= closeMinutes; mins += stepMin) {
    const x = new Date(d);
    x.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    slots.push(x);
  }
  return slots;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

async function getSlotsForDate(targetDay: Date, stepMin: number): Promise<Date[]> {
  const dow = targetDay.getDay();

  const [hrs, offDay] = await Promise.all([
    db.businessHours.findUnique({ where: { dayOfWeek: dow } }),
    db.businessOffDay.findFirst({
      where: {
        date: {
          gte: new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate()),
          lt:  new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate() + 1),
        },
      },
    }),
  ]);

  // Closed day or off-day → no slots
  if (!hrs || !hrs.isOpen || offDay) return [];

  const openMinutes  = toMinutes(hrs.openTime);
  const closeMinutes = toMinutes(hrs.closeTime);

  return buildSlotsForDay(targetDay, stepMin, openMinutes, closeMinutes);
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
    // Step equals the service duration: each slot occupies the full service block
    const stepMin = durationMin;

    let slots: Date[];

    if (dateParam) {
      const [y, mo, d] = dateParam.split("-").map(Number);
      const targetDay = new Date(y, mo - 1, d);
      slots = await getSlotsForDate(targetDay, stepMin);
    } else {
      // Legacy: next 2 days
      const now = new Date();
      const d1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const d2 = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const [s1, s2] = await Promise.all([
        getSlotsForDate(d1, stepMin),
        getSlotsForDate(d2, stepMin),
      ]);
      slots = [...s1, ...s2];
    }

    if (slots.length === 0) {
      return NextResponse.json({ ok: true, data: { slots: [] } });
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
