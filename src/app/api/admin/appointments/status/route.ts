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
      customerId: true,
      service: { select: { name: true } },
    },
  });

  await db.appointment.update({
    where: { id },
    data: { status: status as any },
  });

  // Notify the customer if they have an account
  if (appointment?.customerId) {
    await NotificationService.triggerOnAppointmentStatus(
      appointment.customerId,
      id,
      status,
      appointment.service?.name ?? "servicio"
    );
  }

  return NextResponse.redirect(new URL("/admin/appointments", req.url));
}
