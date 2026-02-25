import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkStaffAuth } from "@/lib/staff-auth";

export async function GET() {
  const auth = await checkStaffAuth();
  if (!auth.authorized) return auth.response;

  // Get unique customers from this staff member's appointments
  const appointments = await db.appointment.findMany({
    where: { staffId: auth.user.id },
    select: {
      customerId: true,
      customer: { select: { id: true, name: true, email: true, image: true } },
      payments: {
        select: { id: true, status: true, amountCents: true, currency: true, createdAt: true },
      },
      startAt: true,
      endAt: true,
      status: true,
      service: { select: { name: true } },
    },
    orderBy: { startAt: "desc" },
  });

  // Group by customer
  const clientMap = new Map<string, {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    appointments: typeof appointments;
    totalPaidCents: number;
  }>();

  for (const appt of appointments) {
    if (!appt.customer) continue;
    const cid = appt.customerId!;
    if (!clientMap.has(cid)) {
      clientMap.set(cid, {
        id: cid,
        name: appt.customer.name,
        email: appt.customer.email,
        image: appt.customer.image,
        appointments: [],
        totalPaidCents: 0,
      });
    }
    const entry = clientMap.get(cid)!;
    entry.appointments.push(appt);
    for (const pay of appt.payments) {
      if (pay.status === "PAID") {
        entry.totalPaidCents += pay.amountCents;
      }
    }
  }

  const clients = Array.from(clientMap.values()).map((c) => ({
    ...c,
    appointmentCount: c.appointments.length,
    lastAppointment: c.appointments[0]?.startAt ?? null,
  }));

  return NextResponse.json({ ok: true, data: clients });
}
