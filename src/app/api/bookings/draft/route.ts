import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Body = {
  serviceId: string;
  staffId: string;
  startAt: string; // ISO
  customer: { name: string; email: string; phone?: string };
  notes?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const serviceId = body.serviceId?.trim();
    const staffId = body.staffId?.trim();
    const startAtIso = body.startAt;
    const customer = body.customer;

    if (!serviceId || !staffId || !startAtIso || !customer?.email || !customer?.name) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service || !service.isActive) {
      return NextResponse.json(
        { ok: false, error: { code: "SERVICE_NOT_FOUND", message: "Service not found" } },
        { status: 404 }
      );
    }

    // precio staff+service
    const price = await db.serviceStaffPrice.findUnique({
      where: { serviceId_staffId: { serviceId, staffId } },
    });

    if (!price) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_PRICE", message: "No price configured for this staff/service" } },
        { status: 400 }
      );
    }

    const start = new Date(startAtIso);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_DATE", message: "Invalid startAt" } },
        { status: 400 }
      );
    }

    // endAt obligatorio
    const end = new Date(start.getTime() + service.durationMin * 60 * 1000);

    // Crear/obtener customer user por email (MVP)
    const customerUser = await db.user.upsert({
      where: { email: customer.email.toLowerCase() },
      create: {
        email: customer.email.toLowerCase(),
        name: customer.name,
        role: "STUDENT",
      },
      update: { name: customer.name },
      select: { id: true },
    });

    // evitar doble booking (simple)
    const existing = await db.appointment.findFirst({
      where: {
        serviceId,
        staffId,
        startAt: start,
        status: { in: ["PENDING", "CONFIRMED"] as any },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: { code: "TAKEN", message: "Ese horario ya no está disponible" } },
        { status: 409 }
      );
    }

    // ✅ Crear cita (sin metadata)
    const appointment = await db.appointment.create({
      data: {
        serviceId,
        staffId,
        customerId: customerUser.id,
        startAt: start,
        endAt: end,
        notes: body.notes ?? null,
        status: "PENDING",
      },
      select: { id: true },
    });

    return NextResponse.json({
      ok: true,
      data: {
        appointmentId: appointment.id,
        billingRule: service.billingRule, // FULL | DEPOSIT | AUTHORIZE
        // opcional: por si te sirve en el front
        priceCents: price.priceCents,
        currency: price.currency,
        durationMin: service.durationMin,
        depositPct: service.depositPct ?? null,
      },
    });
  } catch (err: any) {
    console.error("DRAFT ERROR:", err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: { code: "DRAFT_ERROR", message: err?.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}
