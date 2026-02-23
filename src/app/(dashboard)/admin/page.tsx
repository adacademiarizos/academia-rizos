import { protectAdminPage } from '@/lib/protect-admin-page'
import { db } from "@/lib/db";

function money(cents: number, currency = "EUR") {
  const symbol = currency === "EUR" ? "€" : currency + " ";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export default async function AdminOverviewPage() {
  // Protect this page - redirects if not ADMIN
  await protectAdminPage()

  const now = new Date();

  // ── hoy ───────────────────────────────────────────────────────────────────
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  // ── este mes ──────────────────────────────────────────────────────────────
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [todayAppointments, pending, monthAppointments, revenue] = await Promise.all([
    db.appointment.count({
      where: { startAt: { gte: startOfDay, lte: endOfDay } },
    }),
    db.appointment.count({ where: { status: "PENDING" } }),
    db.appointment.count({
      where: { startAt: { gte: startOfMonth, lte: endOfMonth } },
    }),
    db.payment.aggregate({
      _sum: { amountCents: true },
      where: { status: "PAID" },
    }),
  ]);

  const monthName = now.toLocaleDateString("es-AR", { month: "long" });

  return (
    <div className="mx-auto max-w-3000">
      <h1 className="text-2xl font-semibold text-white">Overview</h1>
      <p className="mt-1 text-sm text-white/60">Métricas básicas (MVP).</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard title="Citas hoy" value={String(todayAppointments)} />
        <StatCard
          title={`Citas en ${monthName}`}
          value={String(monthAppointments)}
          highlight
        />
        <StatCard title="Pendientes" value={String(pending)} />
        <StatCard title="Ingresos (pagos)" value={money(revenue._sum.amountCents ?? 0)} />
      </div>

      <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl">
        <div className="text-sm font-semibold text-white">Siguiente</div>
        <p className="mt-2 text-sm text-white/70">
          Vista calendario + filtros. Reporte de no-shows. Links de pago.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-[28px] border p-6 backdrop-blur-3xl ${
      highlight
        ? "border-ap-copper/30 bg-ap-copper/10"
        : "border-white/10 bg-white/5"
    }`}>
      <div className={`text-xs ${highlight ? "text-ap-copper/80" : "text-white/55"}`}>{title}</div>
      <div className={`mt-2 text-2xl font-semibold ${highlight ? "text-ap-copper" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
