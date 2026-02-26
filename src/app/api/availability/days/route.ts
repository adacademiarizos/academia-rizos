import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("serviceId") ?? "";
    const staffId = url.searchParams.get("staffId") ?? "";
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month")); // 1-12

    if (!serviceId || !staffId || !year || !month) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_PARAMS", message: "serviceId, staffId, year, month are required" } },
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
    // Step equals the service duration so slots don't overlap
    const stepMin = durationMin;
    const now = new Date();
    const maxDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Build list of candidate days in the requested month
    const daysInMonth = new Date(year, month, 0).getDate();
    const candidateDays: Date[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month - 1, d, 12, 0, 0);
      if (day > now && day <= maxDate) {
        candidateDays.push(new Date(year, month - 1, d));
      }
    }

    if (candidateDays.length === 0) {
      return NextResponse.json({ ok: true, data: { availableDates: [] } });
    }

    const rangeStart = new Date(year, month - 1, 1);
    const rangeEnd = new Date(year, month, 0, 23, 59, 59);

    // Fetch business hours (all days of week) and off-days for the month in parallel
    const [allBusinessHours, offDays, appointments] = await Promise.all([
      db.businessHours.findMany(),
      db.businessOffDay.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd } },
        select: { date: true },
      }),
      db.appointment.findMany({
        where: {
          staffId,
          status: { in: ["PENDING", "CONFIRMED"] },
          startAt: { lt: rangeEnd },
          endAt: { gt: rangeStart },
        },
        select: { startAt: true, endAt: true },
      }),
    ]);

    const hoursByDow = new Map(allBusinessHours.map((h) => [h.dayOfWeek, h]));
    const offDaySet = new Set(offDays.map((o) => toYMD(o.date)));

    const availableDates: string[] = [];

    for (const day of candidateDays) {
      const ymd = toYMD(day);
      const dow = day.getDay();
      const hrs = hoursByDow.get(dow);

      // Skip closed days and off-days
      if (!hrs || !hrs.isOpen || offDaySet.has(ymd)) continue;

      const openMinutes  = toMinutes(hrs.openTime);
      const closeMinutes = toMinutes(hrs.closeTime);

      // Generate slots for this day respecting open/close and service duration
      const slots: Date[] = [];
      for (let mins = openMinutes; mins + stepMin <= closeMinutes; mins += stepMin) {
        const x = new Date(day);
        x.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
        if (x.getTime() > Date.now()) slots.push(x);
      }

      // Mark day available if at least one slot has no conflicting appointment
      const hasAvailable = slots.some((candidateStart) => {
        const candidateEnd = new Date(candidateStart.getTime() + durationMin * 60 * 1000);
        return !appointments.some(
          (a) => a.startAt < candidateEnd && a.endAt > candidateStart
        );
      });

      if (hasAvailable) availableDates.push(ymd);
    }

    return NextResponse.json({ ok: true, data: { availableDates } });
  } catch (err: any) {
    console.error("AVAILABILITY/DAYS ERROR:", err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: { code: "AVAILABILITY_ERROR", message: err?.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}
