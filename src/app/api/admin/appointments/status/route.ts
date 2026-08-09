import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { NotificationEventService } from "@/server/services/notification-event-service";

export async function POST(req: Request) {
  // Check authentication
  const auth = await checkAdminAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");

  if (!id || !status) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_INPUT", message: "Missing fields" } },
      { status: 400 }
    );
  }

  const allowedStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "NO_SHOW", "COMPLETED"] as const;
  if (!allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_STATUS", message: "Invalid status" } },
      { status: 400 }
    );
  }

  // Fetch appointment to get customer info before updating
  const appointment = await db.appointment.findUnique({
    where: { id },
    select: {
      status: true,
      customerId: true,
      customerEmail: true,
      customer: { select: { id: true, email: true } },
      staff: { select: { id: true, email: true } },
      service: { select: { name: true } },
    },
  });

  if (!appointment) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
      { status: 404 }
    );
  }

  const updated = await db.appointment.update({
    where: { id },
    data: { status: status as (typeof allowedStatuses)[number] },
    select: { id: true, status: true, updatedAt: true },
  });

  if (appointment.status !== updated.status) {
    const serviceName = appointment.service?.name ?? "servicio";
    await NotificationEventService.appointmentStatusChanged({
      appointmentId: updated.id,
      status: updated.status,
      serviceName,
      transitionId: updated.updatedAt.toISOString(),
      staff: appointment.staff,
      customer: appointment.customer,
      customerEmail: appointment.customerEmail,
    });
  }

  return NextResponse.redirect(new URL("/admin/appointments", req.url));
}
