import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { NotificationService } from "@/server/services/notification-service";

export const dynamic = "force-dynamic";

type Body = { status: "PENDING" | "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED" };

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // ✅ Next 16 params promise
) {
  try {
    // Check authentication
    const auth = await checkAdminAuth();
    if (!auth.authorized) {
      return auth.response;
    }

    const { id } = await ctx.params;
    const body = (await req.json()) as Body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_ID", message: "Missing id" } },
        { status: 400 }
      );
    }

    const allowed = ["PENDING", "CONFIRMED", "CANCELLED", "NO_SHOW", "COMPLETED"] as const;
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_STATUS", message: "Invalid status" } },
        { status: 400 }
      );
    }

    const updated = await db.appointment.update({
      where: { id },
      data: { status: body.status },
      select: { id: true, status: true, customerId: true, service: { select: { name: true } } },
    });

    // Notify customer about status change
    if (updated.customerId) {
      NotificationService.triggerOnAppointmentStatus(
        updated.customerId,
        updated.id,
        updated.status,
        updated.service?.name ?? 'tu servicio'
      ).catch((err) => console.error('Appointment status notification failed:', err))
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (err: any) {
    console.error("APPOINTMENT UPDATE ERROR:", err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: { code: "UPDATE_ERROR", message: err?.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}
