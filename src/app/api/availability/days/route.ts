import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

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
    const stepMin = 30;
    const now = new Date();
    const maxDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Build list of candidate days in the requested month
    const daysInMonth = new Date(year, month, 0).getDate(); // last day of month
    const candidateDays: Date[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month - 1, d, 12, 0, 0);
      // Only include days that are after today and within 30-day window
      if (day > now && day <= maxDate) {
        candidateDays.push(new Date(year, month - 1, d));
      }
    }

    if (candidateDays.length === 0) {
      return NextResponse.json({ ok: true, data: { availableDates: [] } });
    }

    // Fetch all appointments for this staff in the whole month range
    const rangeStart = new Date(year, month - 1, 1);
    const rangeEnd = new Date(year, month, 0, 23, 59, 59);

    const appointments = await db.appointment.findMany({
      where: {
        staffId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { lt: rangeEnd },
        endAt: { gt: rangeStart },
      },
      select: { startAt: true, endAt: true },
    });

    // For each candidate day, check if at least one 30-min slot is free
    const availableDates: string[] = [];

    for (const day of candidateDays) {
      // Build slots for this day
      const slots: Date[] = [];
      for (let h = 9; h < 18; h++) {
        for (let m = 0; m < 60; m += stepMin) {
          const x = new Date(day);
          x.setHours(h, m, 0, 0);
          if (x.getTime() > Date.now()) slots.push(x);
        }
      }

      // Check if any slot is free
      const hasAvailable = slots.some((candidateStart) => {
        const candidateEnd = new Date(candidateStart.getTime() + durationMin * 60 * 1000);
        return !appointments.some(
          (a) => a.startAt < candidateEnd && a.endAt > candidateStart
        );
      });

      if (hasAvailable) {
        const yyyy = day.getFullYear();
        const mm = String(day.getMonth() + 1).padStart(2, "0");
        const dd = String(day.getDate()).padStart(2, "0");
        availableDates.push(`${yyyy}-${mm}-${dd}`);
      }
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
