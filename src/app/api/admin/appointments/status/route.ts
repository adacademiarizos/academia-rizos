import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { NotificationService } from "@/server/services/notification-service";

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

  // Fetch appointment to get customer info before updating
  const appointment = await db.appointment.findUnique({
    where: { id },
    select: {
      status: true,
      customerId: true,
      staffId: true,
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
    data: { status: status as any },
    select: { id: true, status: true },
  });

  if (appointment.status !== updated.status) {
    const serviceName = appointment.service?.name ?? "servicio";
    const notificationTasks = [
      NotificationService.triggerOnAppointmentStatus(
        appointment.staffId,
        updated.id,
        updated.status,
        serviceName
      ),
    ];

    if (appointment.customerId) {
      notificationTasks.push(
        NotificationService.triggerOnAppointmentStatus(
          appointment.customerId,
          updated.id,
          updated.status,
          serviceName
        )
      );
    }

    await Promise.all(notificationTasks);
  }

  return NextResponse.redirect(new URL("/admin/appointments", req.url));
}
