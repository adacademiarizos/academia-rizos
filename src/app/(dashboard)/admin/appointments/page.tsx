import { db } from "@/lib/db";
import AppointmentsTable from "./ui/AppointmentsTable";

export const dynamic = "force-dynamic";

export default async function AdminAppointmentsPage() {
  const [raw, staffList] = await Promise.all([
    db.appointment.findMany({
      orderBy: { startAt: "asc" },
      include: {
        service: { select: { id: true, name: true, durationMin: true } },
        variant: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true, email: true } },
        payments: true,
      },
    }),
    db.user.findMany({
      where: { role: { in: ["STAFF", "ADMIN"] } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Normalize customer display data: prefer linked User, fall back to inline fields
  const appointments = raw.map((a) => ({
    ...a,
    customer: {
      id:    a.customerId ?? "guest",
      name:  a.customerName  ?? null,
      email: a.customerEmail ?? "—",
      phone: a.customerPhone ?? null,
    },
  }));

  return (
    <main className="min-h-screen bg-[#181716] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="font-[var(--font-display)] text-3xl md:text-4xl">Citas</h1>
          <p className="mt-2 text-white/60 text-sm">
            Administrá reservas, estados y pagos. Por defecto se muestran las citas de hoy.
          </p>
        </div>

        <AppointmentsTable initial={appointments as any} staffList={staffList} />
      </div>
    </main>
  );
}
