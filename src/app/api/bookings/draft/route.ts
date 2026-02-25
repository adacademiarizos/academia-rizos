import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendAppointmentNotificationEmail } from "@/lib/mail";
import { NotificationService } from "@/server/services/notification-service";

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

    // For AUTHORIZE (pay on-site), notify staff + admins immediately since
    // no Stripe webhook will fire to handle notifications.
    if (service.billingRule === "AUTHORIZE") {
      const [staffUser, admins] = await Promise.all([
        db.user.findUnique({
          where: { id: staffId },
          select: { id: true, name: true, email: true },
        }),
        db.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true, email: true },
        }),
      ]);

      const staffName = staffUser?.name ?? "Especialista";

      // De-duplicate: staff member may also be an admin
      const recipientEmails = [
        ...(staffUser?.email ? [staffUser.email] : []),
        ...admins.map((a) => a.email),
      ].filter((v, i, arr) => v && arr.indexOf(v) === i) as string[];

      const notifyUserIds = [
        ...(staffUser ? [staffUser.id] : []),
        ...admins.map((a) => a.id),
      ].filter((v, i, arr) => arr.indexOf(v) === i);

      // Email notification (fire and forget — don't block response)
      if (recipientEmails.length > 0) {
        sendAppointmentNotificationEmail({
          to: recipientEmails,
          customerName: customer.name,
          customerEmail: customer.email,
          serviceName: service.name,
          staffName,
          startAt: start,
          endAt: end,
          notes: body.notes || undefined,
        }).catch((err) => console.error("DRAFT NOTIFY EMAIL ERROR:", err));
      }

      // In-app notifications for staff + admins
      const notifMessage = `${customer.name} solicitó una cita de ${service.name}`;
      for (const userId of notifyUserIds) {
        NotificationService.createNotification({
          userId,
          type: "APPOINTMENT",
          title: "Nueva solicitud de cita",
          message: notifMessage,
          relatedId: appointment.id,
        }).catch((err) => console.error("DRAFT NOTIFY DB ERROR:", err));
      }
    }

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
