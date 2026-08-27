import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { NotificationEventService } from "@/server/services/notification-event-service";

type Body = {
  serviceId: string;
  staffId: string;
  variantId?: string;
  startAt: string; // ISO
  customer: { name: string; email: string; phone?: string };
  notes?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const serviceId = body.serviceId?.trim();
    const staffId = body.staffId?.trim();
    const variantId = body.variantId?.trim() || null;
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

    // precio staff+service (o variante)
    let price: { priceCents: number; currency: string } | null = null;
    let resolvedDuration: number;

    if (variantId) {
      const variant = await db.serviceVariant.findUnique({
        where: { id: variantId },
        select: { durationMin: true },
      });
      resolvedDuration = variant?.durationMin ?? service.durationMin ?? 30;

      const vp = await db.variantStaffPrice.findUnique({
        where: { variantId_staffId: { variantId, staffId } },
      });
      if (vp) price = { priceCents: vp.priceCents, currency: vp.currency };
    } else {
      resolvedDuration = service.durationMin ?? 30;

      const sp = await db.serviceStaffPrice.findUnique({
        where: { serviceId_staffId: { serviceId, staffId } },
      });
      if (sp) price = { priceCents: sp.priceCents, currency: sp.currency };
    }

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
    const end = new Date(start.getTime() + resolvedDuration * 60 * 1000);

    // Si el email ya tiene cuenta registrada, vinculamos el customerId
    const existingUser = await db.user.findUnique({
      where: { email: customer.email.toLowerCase() },
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

    // ✅ Crear cita — customer info stored directly (no account creation)
    const appointment = await db.appointment.create({
      data: {
        serviceId,
        staffId,
        variantId,
        customerId: existingUser?.id ?? null,
        customerName: customer.name,
        customerEmail: customer.email.toLowerCase(),
        customerPhone: customer.phone ?? null,
        startAt: start,
        endAt: end,
        notes: body.notes ?? null,
        status: "PENDING",
      },
      select: { id: true },
    });

    // AUTHORIZE has no Stripe webhook. The central event service owns the
    // operational recipient matrix and does not block a valid booking.
    if (service.billingRule === "AUTHORIZE") {
      const staffUser = await db.user.findUnique({
        where: { id: staffId },
        select: { id: true, name: true, email: true },
      });

      if (staffUser) {
        await NotificationEventService.appointmentRequested({
          appointmentId: appointment.id,
          serviceName: service.name,
          customerName: customer.name,
          staff: staffUser,
          customer: existingUser ? { id: existingUser.id, email: customer.email.toLowerCase() } : null,
          customerEmail: customer.email,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        appointmentId: appointment.id,
        billingRule: service.billingRule, // FULL | DEPOSIT | AUTHORIZE
        // opcional: por si te sirve en el front
        priceCents: price?.priceCents ?? 0,
        currency: price?.currency ?? "EUR",
        durationMin: resolvedDuration,
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
