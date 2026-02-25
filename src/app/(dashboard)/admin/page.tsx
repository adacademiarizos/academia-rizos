import { protectAdminPage } from '@/lib/protect-admin-page'
import { db } from "@/lib/db";

function money(cents: number, currency = "EUR") {
  const sym = currency === "EUR" ? "€" : currency + " ";
  return `${sym}${(cents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminOverviewPage() {
  await protectAdminPage();

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    // ── Usuarios ─────────────────────────────────────────────────────────────
    totalUsers,
    newUsersMonth,
    // ── Ingresos ─────────────────────────────────────────────────────────────
    revenueTotal,
    revenueMonth,
    revenueAppointment,
    revenueCourse,
    revenueLink,
    // ── Citas ────────────────────────────────────────────────────────────────
    todayAppointments,
    monthConfirmed,
    pendingAppointments,
    cancelledMonth,
    noShowMonth,
    completedMonth,
    // ── Academia ─────────────────────────────────────────────────────────────
    totalEnrollments,
    activeEnrollments,
    activeCourses,
    certificates,
    pendingExamSubs,
    pendingCourseSubs,
    // ── Reportes ─────────────────────────────────────────────────────────────
    bugReportsTotal,
    bugContent,
    bugFunctionality,
  ] = await Promise.all([
    // usuarios
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    // ingresos
    db.payment.aggregate({ _sum: { amountCents: true }, where: { status: "PAID" } }),
    db.payment.aggregate({ _sum: { amountCents: true }, where: { status: "PAID", createdAt: { gte: startOfMonth } } }),
    db.payment.aggregate({ _sum: { amountCents: true }, where: { status: "PAID", type: "APPOINTMENT" } }),
    db.payment.aggregate({ _sum: { amountCents: true }, where: { status: "PAID", type: "COURSE" } }),
    db.payment.aggregate({ _sum: { amountCents: true }, where: { status: "PAID", type: "PAYMENT_LINK" } }),
    // citas
    db.appointment.count({ where: { startAt: { gte: startOfDay, lte: endOfDay } } }),
    db.appointment.count({ where: { status: "CONFIRMED", startAt: { gte: startOfMonth } } }),
    db.appointment.count({ where: { status: "PENDING" } }),
    db.appointment.count({ where: { status: "CANCELLED", startAt: { gte: startOfMonth } } }),
    db.appointment.count({ where: { status: "NO_SHOW", startAt: { gte: startOfMonth } } }),
    db.appointment.count({ where: { status: "COMPLETED", startAt: { gte: startOfMonth } } }),
    // academia
    db.courseAccess.count(),
    db.courseAccess.count({ where: { OR: [{ accessUntil: null }, { accessUntil: { gt: now } }] } }),
    db.course.count({ where: { isActive: true } }),
    db.certificate.count({ where: { valid: true } }),
    db.examSubmission.count({ where: { status: "PENDING" } }),
    db.courseTestSubmission.count({ where: { status: "PENDING", courseTest: { isFinalExam: true } } }),
    // reportes
    db.bugReport.count(),
    db.bugReport.count({ where: { bugType: "CONTENT" } }),
    db.bugReport.count({ where: { bugType: "FUNCTIONALITY" } }),
  ]);

  const monthName = now.toLocaleDateString("es-AR", { month: "long" });
  const pendingExamTotal = pendingExamSubs + pendingCourseSubs;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-white">Overview</h1>
        <p className="mt-1 text-sm text-white/50">{now.toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* ── Usuarios ─────────────────────────────────────────────────────────── */}
      <Section title="Usuarios">
        <StatCard title="Usuarios totales" value={String(totalUsers)} />
        <StatCard title={`Nuevos en ${monthName}`} value={String(newUsersMonth)} highlight />
      </Section>

      {/* ── Ingresos ─────────────────────────────────────────────────────────── */}
      <Section title="Ingresos">
        <StatCard title="Total cobrado" value={money(revenueTotal._sum.amountCents ?? 0)} highlight />
        <StatCard title={`Cobrado en ${monthName}`} value={money(revenueMonth._sum.amountCents ?? 0)} />
        <StatCard title="Vía citas" value={money(revenueAppointment._sum.amountCents ?? 0)} sub />
        <StatCard title="Vía cursos" value={money(revenueCourse._sum.amountCents ?? 0)} sub />
        <StatCard title="Vía links de pago" value={money(revenueLink._sum.amountCents ?? 0)} sub />
      </Section>

      {/* ── Citas ────────────────────────────────────────────────────────────── */}
      <Section title="Citas">
        <StatCard title="Hoy" value={String(todayAppointments)} highlight />
        <StatCard title={`Confirmadas en ${monthName}`} value={String(monthConfirmed)} />
        <StatCard title="Pendientes de confirmar" value={String(pendingAppointments)} warn={pendingAppointments > 0} />
        <StatCard title={`Completadas en ${monthName}`} value={String(completedMonth)} />
        <StatCard title={`Canceladas en ${monthName}`} value={String(cancelledMonth)} />
        <StatCard title={`No-shows en ${monthName}`} value={String(noShowMonth)} />
      </Section>

      {/* ── Academia ─────────────────────────────────────────────────────────── */}
      <Section title="Academia">
        <StatCard title="Cursos activos" value={String(activeCourses)} />
        <StatCard title="Matrículas totales" value={String(totalEnrollments)} />
        <StatCard title="Matrículas vigentes" value={String(activeEnrollments)} highlight />
        <StatCard title="Certificados emitidos" value={String(certificates)} />
        <StatCard title="Exámenes pendientes de revisión" value={String(pendingExamTotal)} warn={pendingExamTotal > 0} />
      </Section>

      {/* ── Reportes ─────────────────────────────────────────────────────────── */}
      <Section title="Reportes de bugs">
        <StatCard title="Total reportes" value={String(bugReportsTotal)} warn={bugReportsTotal > 0} />
        <StatCard title="De contenido" value={String(bugContent)} sub />
        <StatCard title="De funcionalidad" value={String(bugFunctionality)} sub />
      </Section>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  highlight = false,
  warn = false,
  sub = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
  sub?: boolean;
}) {
  const border = warn
    ? "border-orange-500/30 bg-orange-500/10"
    : highlight
    ? "border-ap-copper/30 bg-ap-copper/10"
    : "border-white/10 bg-white/5";

  const label = warn ? "text-orange-400/80" : highlight ? "text-ap-copper/80" : sub ? "text-white/35" : "text-white/55";
  const val   = warn ? "text-orange-400" : highlight ? "text-ap-copper" : "text-white";

  return (
    <div className={`rounded-[22px] border p-5 backdrop-blur-3xl ${border}`}>
      <div className={`text-xs ${label}`}>{title}</div>
      <div className={`mt-2 text-2xl font-semibold ${val}`}>{value}</div>
    </div>
  );
}
