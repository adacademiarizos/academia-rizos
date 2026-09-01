import Link from "next/link";
import { ArrowRight, BookOpenCheck, ChartNoAxesCombined, GraduationCap, TriangleAlert, UsersRound } from "lucide-react";
import { protectAdminPage } from "@/lib/protect-admin-page";
import { parseAnalyticsDateRange } from "@/lib/analytics/date-range";
import { AdminExecutiveOverviewService, type ExecutiveOverviewSnapshot, type OverviewMetric } from "@/server/services/admin-executive-overview-service";
import { PeriodControl } from "./components/PeriodControl";

export const dynamic = "force-dynamic";

type AdminOverviewPageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  href: string;
  unavailable?: boolean;
  tone?: "default" | "accent";
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-ES").format(value);
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatRevenue(snapshot: ExecutiveOverviewSnapshot) {
  if (snapshot.revenue.length === 0) return "—";
  return snapshot.revenue.map((item) => formatMoney(item.amountCents, item.currency)).join(" · ");
}

function formatCourseRevenue(revenue: ExecutiveOverviewSnapshot["topCourses"][number]["revenue"]) {
  if (revenue.length === 0) return "—";
  return revenue.map((item) => formatMoney(item.amountCents, item.currency)).join(" · ");
}

function formatPercent(value: number | null) {
  return value == null ? "Sin período comparable" : `${value > 0 ? "↑" : value < 0 ? "↓" : "•"} ${Math.abs(value).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;
}

function formatPercentagePointDelta(metric: OverviewMetric) {
  return metric.delta == null
    ? "Sin período comparable"
    : `${metric.delta > 0 ? "↑" : metric.delta < 0 ? "↓" : "•"} ${Math.abs(metric.delta).toLocaleString("es-ES", { maximumFractionDigits: 1 })} pp`;
}

function analyticsHref(path: string, range: ExecutiveOverviewSnapshot["range"], extra?: Record<string, string>) {
  const params = new URLSearchParams({ from: range.fromKey, to: range.toKey, ...extra });
  return `${path}?${params.toString()}`;
}

function sectionUnavailable(snapshot: ExecutiveOverviewSnapshot, section: ExecutiveOverviewSnapshot["unavailableSections"][number]) {
  return snapshot.unavailableSections.includes(section);
}

function MetricCard({ label, value, detail, href, unavailable, tone = "default" }: MetricCardProps) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.07] ${
        tone === "accent"
          ? "border-ap-copper/35 bg-ap-copper/10"
          : "border-white/10 bg-black/20"
      }`}
    >
      <p className="text-xs font-medium text-white/55">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{unavailable ? "—" : value}</p>
      <p className={`mt-2 text-xs ${unavailable ? "text-amber-200/80" : "text-white/50"}`}>
        {unavailable ? "No disponible ahora" : detail}
      </p>
    </Link>
  );
}

function SectionUnavailable({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-5 text-sm text-white/55">
      <p className="font-medium text-white/80">{title} no está disponible ahora.</p>
      <p className="mt-1 text-xs">El resto del overview sigue operativo. Intenta actualizar en unos minutos.</p>
    </div>
  );
}

function AcquisitionPerformance({ snapshot }: { snapshot: ExecutiveOverviewSnapshot }) {
  if (sectionUnavailable(snapshot, "traffic")) return <SectionUnavailable title="La tendencia de adquisición" />;

  const maxSessions = Math.max(...snapshot.traffic.map((point) => point.sessions), 1);
  const maxPurchases = Math.max(...snapshot.traffic.map((point) => point.purchases), 1);
  const funnel = snapshot.funnel;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ap-copper">Website</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Adquisición → venta</h2>
          <p className="mt-1 text-sm text-white/50">Sesiones del website y compras de curso por día.</p>
        </div>
        <Link href={analyticsHref("/admin/analytics/conversions", snapshot.range, { scope: "academy" })} className="inline-flex items-center gap-2 text-sm font-semibold text-ap-copper hover:text-ap-copper/80">
          Ver conversiones <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-7 flex h-48 items-end gap-1.5 border-b border-white/10 pb-1" aria-label="Tendencia de sesiones y compras">
        {snapshot.traffic.map((point) => (
          <div key={point.date} className="group relative flex h-full flex-1 items-end gap-0.5">
            <div className="min-h-1 flex-1 rounded-t bg-ap-copper/70" style={{ height: `${Math.max((point.sessions / maxSessions) * 100, point.sessions ? 4 : 0)}%` }} />
            <div className="min-h-1 w-1 rounded-t bg-emerald-400" style={{ height: `${Math.max((point.purchases / maxPurchases) * 100, point.purchases ? 4 : 0)}%` }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-36 -translate-x-1/2 rounded-lg border border-white/10 bg-[#181716] px-3 py-2 text-xs text-white shadow-xl group-hover:block">
              <p>{point.date}</p>
              <p className="mt-1 text-white/65">{formatNumber(point.sessions)} sesiones</p>
              <p className="text-emerald-300">{formatNumber(point.purchases)} compras</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <FunnelStat label="Sesiones únicas" value={formatNumber(funnel.sessions)} detail="Base del embudo" />
        <FunnelStat label="Vieron un curso" value={formatNumber(funnel.coursePageSessions)} detail={`${funnel.sessions ? ((funnel.coursePageSessions / funnel.sessions) * 100).toFixed(1) : "0.0"}% de sesiones`} />
        <FunnelStat label="Compraron" value={formatNumber(funnel.purchases)} detail={`${funnel.coursePageSessions ? ((funnel.purchases / funnel.coursePageSessions) * 100).toFixed(1) : "0.0"}% de interés`} accent />
      </div>
    </section>
  );
}

function FunnelStat({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-emerald-400/20 bg-emerald-400/10" : "border-white/10 bg-black/20"}`}>
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className={`mt-1 text-xs ${accent ? "text-emerald-200/80" : "text-white/45"}`}>{detail}</p>
    </div>
  );
}

function AcademyHealth({ snapshot }: { snapshot: ExecutiveOverviewSnapshot }) {
  if (sectionUnavailable(snapshot, "academyHealth")) return <SectionUnavailable title="La salud de academia" />;

  const health = snapshot.academyHealth;
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Academia</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Aprendizaje que progresa</h2>
          <p className="mt-1 text-sm text-white/50">Señales de que una compra se convierte en resultado.</p>
        </div>
        <Link href={analyticsHref("/admin/analytics/courses", snapshot.range)} className="inline-flex items-center gap-2 text-sm font-semibold text-ap-copper hover:text-ap-copper/80">
          Ver cursos <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-7 space-y-5">
        <HealthStat label="Retención a 30 días" value={health.retention30 == null ? "—" : `${health.retention30.toFixed(1)}%`} detail={health.retentionCohortSize ? `${formatNumber(health.retentionCohortSize)} matrículas con ventana completa` : "Sin cohorte madura"} />
        <HealthStat label="Progreso medio de módulos" value={health.progressRate == null ? "—" : `${health.progressRate.toFixed(1)}%`} detail="Solo accesos vigentes" />
        <HealthStat label="Tiempo a certificarse" value={health.medianCertificationDays == null ? "—" : `${health.medianCertificationDays.toFixed(1)} días`} detail="Mediana de certificados emitidos en el período" />
      </div>
    </section>
  );
}

function HealthStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4 last:border-0 last:pb-0">
      <div>
        <p className="text-sm font-medium text-white/85">{label}</p>
        <p className="mt-1 text-xs text-white/45">{detail}</p>
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function TopCourses({ snapshot }: { snapshot: ExecutiveOverviewSnapshot }) {
  if (sectionUnavailable(snapshot, "courses")) return <SectionUnavailable title="El ranking de cursos" />;

  if (snapshot.topCourses.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
        <h2 className="text-xl font-semibold text-white">Cursos con resultados</h2>
        <p className="mt-4 text-sm text-white/50">No hay compras de cursos confirmadas en este período.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Ranking</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Cursos con resultados</h2>
        </div>
        <GraduationCap className="h-5 w-5 text-ap-copper" aria-hidden="true" />
      </div>
      <div className="mt-5 divide-y divide-white/10">
        {snapshot.topCourses.map((course) => (
          <Link key={course.courseId} href={analyticsHref("/admin/analytics/courses", snapshot.range, { courseId: course.courseId })} className="grid gap-3 py-4 text-sm transition hover:bg-white/[0.03] sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-2">
            <div>
              <p className="font-medium text-white">{course.title}</p>
              <p className="mt-1 text-xs text-white/45">{formatNumber(course.purchases)} compras · {formatNumber(course.certificates)} certificados</p>
            </div>
            <p className="font-semibold text-white sm:text-right">{formatCourseRevenue(course.revenue)}</p>
            <p className="text-xs text-emerald-300 sm:text-right">{course.conversionRate == null ? "Sin tráfico" : `${course.conversionRate.toFixed(1)}% conv.`}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ReviewAttention({ snapshot }: { snapshot: ExecutiveOverviewSnapshot }) {
  if (sectionUnavailable(snapshot, "reviews") || snapshot.pendingReviews.total === 0) return null;

  const { exams, courseTests } = snapshot.pendingReviews;
  return (
    <Link href="/admin/courses/review" className="flex flex-col gap-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5 transition hover:border-amber-200/60 hover:bg-amber-300/15 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-amber-300 px-2.5 py-1 text-xs font-bold text-[#231b0b]">{snapshot.pendingReviews.total}</span>
        <div>
          <p className="font-semibold text-amber-50">Revisiones que pueden desbloquear certificaciones</p>
          <p className="mt-1 text-sm text-amber-100/75">{exams} exámenes y {courseTests} evaluaciones finales esperan decisión.</p>
        </div>
      </div>
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-100">Revisar ahora <ArrowRight className="h-4 w-4" /></span>
    </Link>
  );
}

function OverviewHeadline({ snapshot }: { snapshot: ExecutiveOverviewSnapshot }) {
  if (sectionUnavailable(snapshot, "performance")) {
    return <p className="text-base text-white/70">Algunas métricas de rendimiento se están recuperando. Los bloques disponibles siguen actualizados.</p>;
  }

  if (snapshot.purchases.value === 0) {
    return <p className="text-base text-white/70">Aún no hay compras confirmadas en este período. Revisa la adquisición y el interés por curso.</p>;
  }

  const conversion = snapshot.conversionRate.delta;
  const tone = conversion != null && conversion > 0 ? "mejor" : conversion != null && conversion < 0 ? "más bajo" : "estable";
  return <p className="text-base text-white/70">La academia registra {formatNumber(snapshot.purchases.value)} compras y la conversión web está {tone} que en el período anterior.</p>;
}

export default async function AdminOverviewPage({ searchParams }: AdminOverviewPageProps) {
  await protectAdminPage();

  const params = await searchParams;
  const requestedRange = parseAnalyticsDateRange(params.from, params.to);
  const fallbackRange = parseAnalyticsDateRange();
  const range = requestedRange.ok ? requestedRange.value : fallbackRange.ok ? fallbackRange.value : null;

  if (!range) {
    throw new Error("No fue posible preparar el rango de analíticas.");
  }

  const snapshot = await AdminExecutiveOverviewService.getSnapshot(range);
  const performanceUnavailable = sectionUnavailable(snapshot, "performance");
  const revenueChange = snapshot.revenue[0]?.deltaPercent ?? null;
  const conversionsHref = analyticsHref("/admin/analytics/conversions", snapshot.range, { scope: "academy" });

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 pb-16">
      <header className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(100,106,64,0.3),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ap-copper">Website + Academia</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Overview ejecutivo</h1>
            <p className="mt-2 text-sm text-white/45">{range.fromKey} — {range.toKey} · actualizado al cargar</p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <PeriodControl from={range.fromKey} to={range.toKey} />
            <Link href={analyticsHref("/admin/analytics", snapshot.range)} className="inline-flex items-center gap-2 text-sm font-semibold text-white/75 transition hover:text-white">
              Ver analíticas completas <ChartNoAxesCombined className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {!requestedRange.ok && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{requestedRange.error} Se mostró el último rango válido por defecto.</p>
          </div>
        )}

        <div className="mt-7">
          <OverviewHeadline snapshot={snapshot} />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Facturación de academia" value={formatRevenue(snapshot)} detail={revenueChange == null ? "Sin período comparable" : formatPercent(revenueChange)} href={conversionsHref} unavailable={performanceUnavailable} tone="accent" />
            <MetricCard label="Compras de cursos" value={formatNumber(snapshot.purchases.value)} detail={formatPercent(snapshot.purchases.deltaPercent)} href={conversionsHref} unavailable={performanceUnavailable} />
            <MetricCard label="Conversión a compra" value={`${snapshot.conversionRate.value.toFixed(1)}%`} detail={formatPercentagePointDelta(snapshot.conversionRate)} href={conversionsHref} unavailable={performanceUnavailable} />
            <MetricCard label="Alumnos activos" value={formatNumber(snapshot.activeLearners.value)} detail={formatPercent(snapshot.activeLearners.deltaPercent)} href={analyticsHref("/admin/analytics/courses", snapshot.range)} unavailable={performanceUnavailable} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <AcquisitionPerformance snapshot={snapshot} />
        <AcademyHealth snapshot={snapshot} />
      </div>

      <TopCourses snapshot={snapshot} />
      <ReviewAttention snapshot={snapshot} />

      <p className="flex items-center gap-2 text-xs text-white/35"><BookOpenCheck className="h-4 w-4" /> Las fuentes, campañas, dispositivos, páginas y detalles de evaluación permanecen en sus vistas especializadas.</p>
      <p className="flex items-center gap-2 text-xs text-white/35"><UsersRound className="h-4 w-4" /> Los alumnos activos combinan actividad de aprendizaje y visitas autenticadas a contenido académico.</p>
    </div>
  );
}
