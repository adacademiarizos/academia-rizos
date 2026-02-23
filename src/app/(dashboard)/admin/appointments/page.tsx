import { db } from "@/lib/db";
import AppointmentsTable from "./ui/AppointmentsTable";

export default async function AdminAppointmentsPage() {
  const appointments = await db.appointment.findMany({
    orderBy: { startAt: "asc" },
    include: {
      service: true,
      staff: true,
      customer: true,
      payments: true,
    },
  });

  return (
    <main className="min-h-screen bg-[#181716] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="font-[var(--font-display)] text-3xl md:text-4xl">Citas</h1>
          <p className="mt-2 text-white/60 text-sm">
            Administrá reservas, estados y pagos. Por defecto se muestran las citas de hoy.
          </p>
        </div>

        <AppointmentsTable initial={appointments as any} />
      </div>
    </main>
  );
}
