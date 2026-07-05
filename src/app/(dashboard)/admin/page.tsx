import Link from "next/link";
import { protectAdminPage } from "@/lib/protect-admin-page";
import { db } from "@/lib/db";
import { MarketingAnalyticsService } from "@/server/services/marketing-analytics-service";

export const dynamic = "force-dynamic";

type CourseAcademyRow = {
  courseId: string;
  courseTitle: string;
  enrollments: bigint;
  certificates: bigint;
};

type UserGrowthRow = {
  month: Date;
  total: bigint;
};

type ModuleDropoffRow = {
  course_title: string;
  module_title: string;
  module_order: number;
  enrolled_users: bigint;
  completed_users: bigint;
};

type CertificationLeadTimeRow = {
  avg_days: number | null;
};

type RetentionRow = {
  enrollments: bigint;
  retained_7: bigint;
  retained_30: bigint;
};

type Segment = {
  label: string;
  value: number;
  color: string;
};

type TrafficPoint = {
  date: string;
  views: number;
  sessions: number;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#f59e0b",
  STAFF: "#3b82f6",
  STUDENT: "#10b981",
};

function number(n: number) {
  return new Intl.NumberFormat("es-ES").format(n || 0);
}

function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function clampPct(v: number) {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthsBack(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() - count, 1);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("es-ES", { month: "short" });
}

function buildDonutGradient(segments: Segment[]) {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  if (total <= 0) return "conic-gradient(#ffffff22 0 100%)";

  let start = 0;
  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.value <= 0) continue;
    const pct = (seg.value / total) * 100;
    const end = start + pct;
    parts.push(`${seg.color} ${start}% ${end}%`);
    start = end;
  }
  return `conic-gradient(${parts.join(", ")})`;
}

function normalizeMonthlySeries(
  rows: UserGrowthRow[],
  fromMonth: Date,
  toMonth: Date
): Array<{ month: Date; total: number }> {
  const map = new Map(rows.map((r) => [new Date(r.month).toISOString().slice(0, 7), Number(r.total)]));
  const out: Array<{ month: Date; total: number }> = [];
  const cursor = new Date(fromMonth.getFullYear(), fromMonth.getMonth(), 1);
  const limit = new Date(toMonth.getFullYear(), toMonth.getMonth(), 1);

  while (cursor <= limit) {
    const key = cursor.toISOString().slice(0, 7);
    out.push({ month: new Date(cursor), total: map.get(key) ?? 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return out;
}

function normalizeDailyTrafficSeries(rows: TrafficPoint[], days: number, anchorDate: Date): TrafficPoint[] {
  const byDate = new Map(
    rows.map((row) => [row.date, { views: Number(row.views) || 0, sessions: Number(row.sessions) || 0 }])
  );
  const start = startOfDay(anchorDate);
  start.setDate(start.getDate() - (days - 1));

  const out: TrafficPoint[] = [];
  for (let i = 0; i < days; i++) {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + i);
    const key = cursor.toISOString().slice(0, 10);
    const data = byDate.get(key);
    out.push({
      date: key,
      views: data?.views ?? 0,
      sessions: data?.sessions ?? 0,
    });
  }
  return out;
}

export default async function AdminOverviewPage() {
  await protectAdminPage();

  /*
   * Temporalmente desactivado por negocio:
   * - Widgets/KPIs de citas
   * - Widgets/KPIs de pagos e ingresos
   * Este overview queda enfocado en website + academia.
   */

  const now = new Date();
  const monthStart = startOfMonth(now);
  const last7Start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const last30Start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  const last90Start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89));
  const sixMonthsStart = monthsBack(now, 5);

  const [
    totalUsers,
    usersByRole,
    newUsersMonth,
    newUsersWeek,
    activeCourses,
    totalEnrollments,
    activeEnrollments,
    certificatesTotal,
    certificatesMonth,
    pendingExamSubs,
    pendingCourseSubs,
    bugReportsTotal,
    bugReportsMonth,
    bugByTypeMonthRaw,
    faqCount,
    resultsCount,
    activeTestimonials,
    marketingOverview,
    marketingTraffic,
    marketingSourcesRaw,
    marketingTopPages,
    deviceBreakdown,
    academyTopCoursesRaw,
    monthlyUserGrowthRows,
    marketingFunnel,
    marketingCampaignsRaw,
    marketingGeoRaw,
    courseAnalyticsRaw,
    moduleSubmissionsTotal,
    moduleSubmissionsPassed,
    moduleSubmissionAvgAttempt,
    moduleSubmissionAvgScore,
    courseTestSubmissionsTotal,
    courseTestSubmissionsPassed,
    courseTestSubmissionAvgAttempt,
    courseTestSubmissionAvgScore,
    examSubmissionsTotal,
    examSubmissionsPassed,
    examSubmissionAvgScore,
    certLeadTimeRaw,
    retentionRaw,
    moduleDropoffRaw,
    activeLearners7,
    activeLearners30,
    activityEvents30,
    submissionEvents30,
    chatMessages30,
    comments30,
    likes30,
    academyResourcesTotal,
  ] = await Promise.all([
    db.user.count(),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.user.count({ where: { createdAt: { gte: monthStart } } }),
    db.user.count({ where: { createdAt: { gte: last7Start } } }),
    db.course.count({ where: { isActive: true } }),
    db.courseAccess.count(),
    db.courseAccess.count({
      where: {
        revokedAt: null,
        OR: [{ accessUntil: null }, { accessUntil: { gt: now } }],
      },
    }),
    db.certificate.count({ where: { valid: true } }),
    db.certificate.count({ where: { valid: true, issuedAt: { gte: monthStart } } }),
    db.examSubmission.count({ where: { status: "PENDING" } }),
    db.courseTestSubmission.count({
      where: { status: "PENDING", courseTest: { isFinalExam: true } },
    }),
    db.bugReport.count(),
    db.bugReport.count({ where: { createdAt: { gte: monthStart } } }),
    db.bugReport.groupBy({
      by: ["bugType"],
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
    }),
    db.faqItem.count(),
    db.resultImage.count(),
    db.testimonial.count({ where: { isActive: true } }),
    MarketingAnalyticsService.getOverviewMetrics({ from: last30Start, to: now }),
    MarketingAnalyticsService.getTrafficTimeSeries({ from: last30Start, to: now }, "day"),
    MarketingAnalyticsService.getTrafficSources({ from: last30Start, to: now }),
    MarketingAnalyticsService.getTopPages({ from: last30Start, to: now }, 6),
    MarketingAnalyticsService.getDeviceBreakdown({ from: last30Start, to: now }),
    db.$queryRaw<CourseAcademyRow[]>`
      SELECT
        c.id AS "courseId",
        c.title AS "courseTitle",
        COUNT(ca.id)::bigint AS enrollments,
        COUNT(cert.id)::bigint AS certificates
      FROM "Course" c
      LEFT JOIN "CourseAccess" ca
        ON ca."courseId" = c.id
       AND ca."revokedAt" IS NULL
      LEFT JOIN "Certificate" cert ON cert."courseId" = c.id AND cert.valid = true
      WHERE c."isActive" = true
      GROUP BY c.id, c.title
      ORDER BY enrollments DESC
      LIMIT 6
    `,
    db.$queryRaw<UserGrowthRow[]>`
      SELECT
        date_trunc('month', "createdAt")::date AS month,
        COUNT(*)::bigint AS total
      FROM "User"
      WHERE "createdAt" >= ${sixMonthsStart}
      GROUP BY month
      ORDER BY month ASC
    `,
    MarketingAnalyticsService.getConversionFunnel({ from: last30Start, to: now }),
    MarketingAnalyticsService.getCampaignPerformance({ from: last30Start, to: now }),
    MarketingAnalyticsService.getGeographicData({ from: last30Start, to: now }),
    MarketingAnalyticsService.getCourseAnalytics({ from: last30Start, to: now }),
    db.moduleSubmission.count(),
    db.moduleSubmission.count({ where: { isPassed: true } }),
    db.moduleSubmission.aggregate({ _avg: { attemptNumber: true } }),
    db.moduleSubmission.aggregate({ _avg: { score: true } }),
    db.courseTestSubmission.count(),
    db.courseTestSubmission.count({ where: { isPassed: true } }),
    db.courseTestSubmission.aggregate({ _avg: { attemptNumber: true } }),
    db.courseTestSubmission.aggregate({ _avg: { score: true } }),
    db.examSubmission.count(),
    db.examSubmission.count({ where: { isPassed: true } }),
    db.examSubmission.aggregate({ _avg: { score: true } }),
    db.$queryRaw<CertificationLeadTimeRow[]>`
      SELECT
        AVG(EXTRACT(EPOCH FROM (cert."issuedAt" - ca."createdAt")) / 86400.0)::double precision AS avg_days
      FROM "Certificate" cert
      INNER JOIN "CourseAccess" ca
        ON ca."courseId" = cert."courseId"
       AND ca."userId" = cert."userId"
       AND ca."revokedAt" IS NULL
      WHERE cert.valid = true
    `,
    db.$queryRaw<RetentionRow[]>`
      SELECT
        COUNT(*)::bigint AS enrollments,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM "UserActivity" ua
            WHERE ua."userId" = ca."userId"
              AND ua."createdAt" >= ca."createdAt"
              AND ua."createdAt" <= ca."createdAt" + interval '7 day'
              AND (ua."courseId" = ca."courseId" OR ua."courseId" IS NULL)
          )
          OR EXISTS (
            SELECT 1
            FROM "PageView" pv
            WHERE pv."userId" = ca."userId"
              AND pv."createdAt" >= ca."createdAt"
              AND pv."createdAt" <= ca."createdAt" + interval '7 day'
              AND (pv."path" LIKE '/learn/%' OR pv."path" LIKE '/courses/%')
          )
        )::bigint AS retained_7,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM "UserActivity" ua
            WHERE ua."userId" = ca."userId"
              AND ua."createdAt" >= ca."createdAt"
              AND ua."createdAt" <= ca."createdAt" + interval '30 day'
              AND (ua."courseId" = ca."courseId" OR ua."courseId" IS NULL)
          )
          OR EXISTS (
            SELECT 1
            FROM "PageView" pv
            WHERE pv."userId" = ca."userId"
              AND pv."createdAt" >= ca."createdAt"
              AND pv."createdAt" <= ca."createdAt" + interval '30 day'
              AND (pv."path" LIKE '/learn/%' OR pv."path" LIKE '/courses/%')
          )
        )::bigint AS retained_30
      FROM "CourseAccess" ca
      WHERE ca."createdAt" >= ${last90Start}
        AND ca."revokedAt" IS NULL
    `,
    db.$queryRaw<ModuleDropoffRow[]>`
      SELECT
        c.title AS course_title,
        m.title AS module_title,
        m."order" AS module_order,
        COUNT(DISTINCT ca."userId")::bigint AS enrolled_users,
        COUNT(DISTINCT mp."userId") FILTER (WHERE mp.completed = true)::bigint AS completed_users
      FROM "Module" m
      INNER JOIN "Course" c ON c.id = m."courseId"
      LEFT JOIN "CourseAccess" ca
        ON ca."courseId" = c.id
       AND ca."revokedAt" IS NULL
      LEFT JOIN "ModuleProgress" mp
        ON mp."moduleId" = m.id
       AND mp."userId" = ca."userId"
      WHERE c."isActive" = true
      GROUP BY c.title, m.title, m."order"
      HAVING COUNT(DISTINCT ca."userId") > 0
      ORDER BY (
        (COUNT(DISTINCT ca."userId") - COUNT(DISTINCT mp."userId") FILTER (WHERE mp.completed = true))::float
        / COUNT(DISTINCT ca."userId")
      ) DESC
      LIMIT 8
    `,
    db.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(DISTINCT "userId")::bigint AS total
      FROM "PageView"
      WHERE "createdAt" >= ${last7Start}
        AND "userId" IS NOT NULL
        AND ("path" LIKE '/learn/%' OR "path" LIKE '/courses/%')
    `,
    db.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(DISTINCT "userId")::bigint AS total
      FROM "PageView"
      WHERE "createdAt" >= ${last30Start}
        AND "userId" IS NOT NULL
        AND ("path" LIKE '/learn/%' OR "path" LIKE '/courses/%')
    `,
    db.userActivity.count({ where: { createdAt: { gte: last30Start } } }),
    Promise.all([
      db.moduleSubmission.count({ where: { submittedAt: { gte: last30Start } } }),
      db.courseTestSubmission.count({ where: { submittedAt: { gte: last30Start } } }),
      db.examSubmission.count({ where: { submittedAt: { gte: last30Start } } }),
    ]).then(([moduleCount, courseTestCount, examCount]) => moduleCount + courseTestCount + examCount),
    db.chatMessage.count({ where: { createdAt: { gte: last30Start } } }),
    db.comment.count({ where: { createdAt: { gte: last30Start } } }),
    db.like.count({ where: { createdAt: { gte: last30Start } } }),
    Promise.all([db.courseResource.count(), db.moduleResource.count()]).then(([courseRes, moduleRes]) => courseRes + moduleRes),
  ]);

  const roleMap = { ADMIN: 0, STAFF: 0, STUDENT: 0 };
  for (const row of usersByRole) roleMap[row.role] = row._count._all;

  const bugTypeMap = { CONTENT: 0, FUNCTIONALITY: 0 };
  for (const row of bugByTypeMonthRaw) bugTypeMap[row.bugType] = row._count._all;

  const pendingReviews = pendingExamSubs + pendingCourseSubs;
  const funnel = marketingFunnel;
  const campaigns = marketingCampaignsRaw.slice(0, 6);
  const maxCampaignSessions = Math.max(...campaigns.map((c) => c.sessions), 1);

  const geoByCountry = new Map<string, { views: number; sessions: number }>();
  for (const item of marketingGeoRaw) {
    const existing = geoByCountry.get(item.country);
    if (existing) {
      existing.views += item.views;
      existing.sessions += item.sessions;
    } else {
      geoByCountry.set(item.country, { views: item.views, sessions: item.sessions });
    }
  }
  const topCountries = Array.from(geoByCountry.entries())
    .map(([country, stats]) => ({ country, ...stats }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);
  const maxCountryViews = Math.max(...topCountries.map((g) => g.views), 1);

  const courseAnalytics = courseAnalyticsRaw.filter((c) => c.pageViews > 0 || c.purchases > 0);
  const topCourseConversion = [...courseAnalytics]
    .filter((c) => c.uniqueVisitors >= 10)
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 6);
  const topCourseRevenue = [...courseAnalytics]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 6);
  const maxCourseRevenue = Math.max(...topCourseRevenue.map((c) => c.revenueCents), 1);

  const modulePassRate = percent(moduleSubmissionsPassed, Math.max(moduleSubmissionsTotal, 1));
  const courseTestPassRate = percent(courseTestSubmissionsPassed, Math.max(courseTestSubmissionsTotal, 1));
  const examPassRate = percent(examSubmissionsPassed, Math.max(examSubmissionsTotal, 1));

  const avgModuleAttempts = moduleSubmissionAvgAttempt._avg.attemptNumber ?? 0;
  const avgCourseTestAttempts = courseTestSubmissionAvgAttempt._avg.attemptNumber ?? 0;
  const avgModuleScore = moduleSubmissionAvgScore._avg.score ?? 0;
  const avgCourseTestScore = courseTestSubmissionAvgScore._avg.score ?? 0;
  const avgExamScore = examSubmissionAvgScore._avg.score ?? 0;

  const certLeadDays = certLeadTimeRaw[0]?.avg_days ?? 0;
  const retentionBase = Number(retentionRaw[0]?.enrollments ?? 0);
  const retention7 = Number(retentionRaw[0]?.retained_7 ?? 0);
  const retention30 = Number(retentionRaw[0]?.retained_30 ?? 0);
  const retention7Rate = percent(retention7, Math.max(retentionBase, 1));
  const retention30Rate = percent(retention30, Math.max(retentionBase, 1));

  const moduleDropoff = moduleDropoffRaw.map((row) => {
    const enrolled = Number(row.enrolled_users);
    const completed = Number(row.completed_users);
    const completionRate = percent(completed, Math.max(enrolled, 1));
    return {
      course: row.course_title,
      module: row.module_title,
      order: row.module_order,
      enrolled,
      completed,
      completionRate,
      dropoffRate: Math.max(0, 100 - completionRate),
    };
  });

  const academyEngagement = {
    activeLearners7: Number(activeLearners7[0]?.total ?? 0),
    activeLearners30: Number(activeLearners30[0]?.total ?? 0),
    activityEvents30,
    submissionEvents30,
    chatMessages30,
    comments30,
    likes30,
    academyResourcesTotal,
  };

  const monthName = now.toLocaleDateString("es-ES", { month: "long" });
  const todayLabel = now.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const trafficLast14 = normalizeDailyTrafficSeries(marketingTraffic, 14, now);
  const hasTrafficData = trafficLast14.some((point) => point.views > 0 || point.sessions > 0);
  const maxTrafficViews = Math.max(...trafficLast14.map((t) => t.views), 1);
  const marketingSources = marketingSourcesRaw.slice(0, 6);
  const maxSourceViews = Math.max(...marketingSources.map((s) => s.views), 1);

  const deviceTotal = deviceBreakdown.devices.reduce((acc, d) => acc + d.count, 0);
  const deviceSegments: Segment[] = deviceBreakdown.devices.slice(0, 3).map((d, i) => ({
    label: d.type || "unknown",
    value: d.count,
    color: ["#646a40", "#3b82f6", "#a855f7"][i] || "#94a3b8",
  }));

  const monthlyUsers = normalizeMonthlySeries(monthlyUserGrowthRows, sixMonthsStart, now);
  const maxMonthlyUsers = Math.max(...monthlyUsers.map((r) => r.total), 1);

  const usersDonutSegments: Segment[] = [
    { label: "Admins", value: roleMap.ADMIN, color: ROLE_COLORS.ADMIN },
    { label: "Staff", value: roleMap.STAFF, color: ROLE_COLORS.STAFF },
    { label: "Students", value: roleMap.STUDENT, color: ROLE_COLORS.STUDENT },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-10 pb-16">
      <header className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(100,106,64,0.26),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-white">Overview Website + Academia</h1>
            <p className="mt-2 text-sm text-white/60">{todayLabel}</p>
            <p className="mt-4 max-w-4xl text-base text-white/55">
              Dashboard consolidado para rendimiento general del sitio y la academia online.
              Los indicadores de citas y pagos estan desactivados temporalmente.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/analytics" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10">
              Ver analiticas
            </Link>
            <Link href="/admin/courses" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10">
              Gestionar cursos
            </Link>
            <Link href="/admin/courses/review" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10">
              Revisar examenes
            </Link>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Visitas 30 dias" value={number(marketingOverview.totalViews)} hint={`${number(marketingOverview.uniqueSessions)} sesiones`} tone="accent" />
          <MetricCard label="Tasa de conversion" value={`${marketingOverview.conversionRate.toFixed(1)}%`} hint={`${number(marketingOverview.totalConversions)} conversiones`} />
          <MetricCard label="Cursos activos" value={number(activeCourses)} hint={`${number(totalEnrollments)} matriculas totales`} />
          <MetricCard label="Retencion 30 dias" value={`${retention30Rate.toFixed(1)}%`} hint={`${number(retention30)} de ${number(retentionBase)} matriculas`} />
          <MetricCard label="Revisiones pendientes" value={number(pendingReviews)} hint={`${number(pendingExamSubs)} examenes + ${number(pendingCourseSubs)} tests`} tone={pendingReviews > 0 ? "warn" : "default"} />
        </div>
      </header>

      <section className="grid gap-8 xl:grid-cols-2">
        <Panel title="Trafico web" subtitle="Comportamiento de visitas y canales de adquisicion (30 dias).">
          <h4 className="text-xs uppercase tracking-widest text-white/40">Visitas diarias (ultimos 14 dias)</h4>
          {!hasTrafficData ? (
            <div className="mt-4">
              <EmptyState text="Aun no hay visitas publicas registradas para graficar. Este bloque solo considera trafico del website (no /admin)." />
            </div>
          ) : (
            <div className="mt-4 flex h-44 items-end gap-1.5">
              {trafficLast14.map((item) => {
                const h = Math.max(8, Math.round((item.views / maxTrafficViews) * 100));
                return (
                  <div key={item.date} className="group relative flex-1">
                    <div className="w-full rounded-t-md bg-gradient-to-t from-[#646a40]/35 to-[#646a40]" style={{ height: `${h}%` }} />
                    <div className="pointer-events-none absolute -top-14 left-1/2 z-10 hidden w-24 -translate-x-1/2 rounded-md border border-white/10 bg-black/90 px-2 py-1 text-[10px] text-white/80 group-hover:block">
                      <p>{item.date.slice(5)}</p>
                      <p>{number(item.views)} views</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-7 space-y-3">
            <h4 className="text-xs uppercase tracking-widest text-white/40">Top fuentes</h4>
            {marketingSources.length === 0 ? (
              <EmptyState text="Sin datos de fuentes en el periodo seleccionado." />
            ) : (
              marketingSources.map((src) => (
                <BarRow
                  key={src.source}
                  label={src.source}
                  value={number(src.views)}
                  ratio={clampPct(percent(src.views, maxSourceViews))}
                  color="#646a40"
                  note={`${number(src.conversions)} conversiones`}
                />
              ))
            )}
          </div>
        </Panel>

        <Panel title="Top paginas" subtitle="Paginas mas visitadas del website en los ultimos 30 dias.">
          <div className="space-y-3">
            {marketingTopPages.length === 0 ? (
              <EmptyState text="Sin pageviews para este periodo." />
            ) : (
              marketingTopPages.map((row, idx) => (
                <div key={row.path} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-white">
                      {idx + 1}. {row.path}
                    </p>
                    <p className="text-sm font-semibold text-white">{number(row.views)}</p>
                  </div>
                  <p className="mt-1 text-xs text-white/45">{number(row.sessions)} sesiones</p>
                </div>
              ))
            )}
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <DonutCard title="Distribucion de dispositivos" total={deviceTotal} segments={deviceSegments} />
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <h4 className="text-xs uppercase tracking-widest text-white/40">Browsers top</h4>
              <div className="mt-3 space-y-2">
                {deviceBreakdown.browsers.slice(0, 5).map((b) => (
                  <BarRow
                    key={b.name}
                    label={b.name}
                    value={number(b.count)}
                    ratio={clampPct(percent(b.count, deviceBreakdown.browsers[0]?.count || 1))}
                    color="#3b82f6"
                  />
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-8 xl:grid-cols-3">
        <Panel title="Funnel website (30 dias)" subtitle="Recorrido de adquisicion y conversion del sitio.">
          <div className="space-y-3">
            <BarRow
              label="Visitantes unicos"
              value={number(funnel.totalVisitors)}
              ratio={100}
              color="#64748b"
            />
            <BarRow
              label="Visitas a paginas de cursos"
              value={number(funnel.coursePageVisitors)}
              ratio={clampPct(percent(funnel.coursePageVisitors, Math.max(funnel.totalVisitors, 1)))}
              color="#3b82f6"
            />
            <BarRow
              label="Compras de cursos"
              value={number(funnel.purchases)}
              ratio={clampPct(percent(funnel.purchases, Math.max(funnel.totalVisitors, 1)))}
              color="#10b981"
            />
            <BarRow
              label="Reservas registradas"
              value={number(funnel.bookings)}
              ratio={clampPct(percent(funnel.bookings, Math.max(funnel.totalVisitors, 1)))}
              color="#b16e34"
            />
            <BarRow
              label="Registros de usuario"
              value={number(funnel.registrations)}
              ratio={clampPct(percent(funnel.registrations, Math.max(funnel.totalVisitors, 1)))}
              color="#a855f7"
            />
          </div>
        </Panel>

        <Panel title="Campanas UTM" subtitle="Rendimiento de campanas por sesiones y conversiones.">
          {campaigns.length === 0 ? (
            <EmptyState text="No hay campanas UTM detectadas en el periodo." />
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <BarRow
                  key={`${campaign.campaign}-${campaign.source}-${campaign.medium}`}
                  label={`${campaign.campaign} · ${campaign.source}`}
                  value={number(campaign.sessions)}
                  ratio={clampPct(percent(campaign.sessions, maxCampaignSessions))}
                  color="#6366f1"
                  note={`${number(campaign.conversions)} conv · ${money(campaign.revenueCents)}`}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Geo performance" subtitle="Paises con mayor consumo del website.">
          {topCountries.length === 0 ? (
            <EmptyState text="Sin datos geograficos en este periodo." />
          ) : (
            <div className="space-y-3">
              {topCountries.map((country) => (
                <BarRow
                  key={country.country}
                  label={country.country}
                  value={number(country.views)}
                  ratio={clampPct(percent(country.views, maxCountryViews))}
                  color="#0ea5e9"
                  note={`${number(country.sessions)} sesiones`}
                />
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-8 xl:grid-cols-3">
        <Panel title="Retencion de academia" subtitle="Cohorte de matriculas creadas en ultimos 90 dias.">
          <div className="grid gap-3">
            <MiniStat label="Matriculas analizadas (cohorte)" value={number(retentionBase)} />
            <BarRow
              label="Retencion 7 dias"
              value={`${retention7Rate.toFixed(1)}%`}
              ratio={retention7Rate}
              color="#0ea5e9"
              note={`${number(retention7)} usuarios activos`}
            />
            <BarRow
              label="Retencion 30 dias"
              value={`${retention30Rate.toFixed(1)}%`}
              ratio={retention30Rate}
              color="#10b981"
              note={`${number(retention30)} usuarios activos`}
            />
          </div>
        </Panel>

        <Panel title="Tiempo a certificacion" subtitle="Promedio desde matricula hasta certificado valido.">
          <div className="grid gap-3">
            <MiniStat
              label="Dias promedio a certificarse"
              value={certLeadDays > 0 ? certLeadDays.toFixed(1) : "-"}
            />
            <p className="text-sm text-white/55">
              Este KPI permite medir cuan rapido conviertes una matricula en un logro completado.
            </p>
          </div>
        </Panel>

        <Panel title="Engagement academy" subtitle="Actividad real de aprendizaje en 7/30 dias.">
          <div className="grid gap-3">
            <MiniStat label="Learners activos 7 dias" value={number(academyEngagement.activeLearners7)} />
            <MiniStat label="Learners activos 30 dias" value={number(academyEngagement.activeLearners30)} />
            <MiniStat label="Eventos de actividad (30d)" value={number(academyEngagement.activityEvents30)} compact />
            <MiniStat label="Envios de evaluaciones (30d)" value={number(academyEngagement.submissionEvents30)} compact />
            <MiniStat label="Mensajes en comunidad (30d)" value={number(academyEngagement.chatMessages30)} compact />
            <MiniStat label="Comentarios + likes (30d)" value={number(academyEngagement.comments30 + academyEngagement.likes30)} compact />
            <MiniStat label="Recursos academicos disponibles" value={number(academyEngagement.academyResourcesTotal)} compact />
          </div>
        </Panel>
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <Panel title="Drop-off por modulo" subtitle="Donde mas se frena el avance del estudiante.">
          {moduleDropoff.length === 0 ? (
            <EmptyState text="No hay datos suficientes para estimar drop-off por modulo." />
          ) : (
            <div className="space-y-3">
              {moduleDropoff.map((item, idx) => (
                <BarRow
                  key={`${item.course}-${item.module}-${idx}`}
                  label={`${item.course} · M${item.order + 1} ${item.module}`}
                  value={`${item.dropoffRate.toFixed(1)}%`}
                  ratio={item.dropoffRate}
                  color="#ef4444"
                  note={`${number(item.completed)} / ${number(item.enrolled)} completan`}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top cursos por ingresos academia" subtitle="Revenue atribuido a compras de curso (30 dias).">
          {topCourseRevenue.length === 0 ? (
            <EmptyState text="Sin compras de cursos en el periodo para ranking de ingresos." />
          ) : (
            <div className="space-y-3">
              {topCourseRevenue.map((course) => (
                <BarRow
                  key={`rev-${course.courseId}`}
                  label={course.courseTitle}
                  value={money(course.revenueCents)}
                  ratio={clampPct(percent(course.revenueCents, maxCourseRevenue))}
                  color="#22c55e"
                  note={`${number(course.purchases)} compras · ${course.conversionRate.toFixed(2)}% conv`}
                />
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <Panel title="Academia" subtitle="Estado actual de cursos, matriculas y certificaciones.">
          <div className="grid gap-4 md:grid-cols-2">
            <MiniStat label="Cursos activos" value={number(activeCourses)} />
            <MiniStat label="Matriculas totales" value={number(totalEnrollments)} />
            <MiniStat label="Accesos vigentes" value={number(activeEnrollments)} />
            <MiniStat label="Certificados validos" value={number(certificatesTotal)} />
            <MiniStat label={`Certificados en ${monthName}`} value={number(certificatesMonth)} />
            <MiniStat label="Pendientes de revision" value={number(pendingReviews)} tone={pendingReviews > 0 ? "warn" : "default"} />
          </div>

          <div className="mt-7 space-y-3">
            <h4 className="text-xs uppercase tracking-widest text-white/40">Cursos con mas traccion</h4>
            {academyTopCoursesRaw.length === 0 ? (
              <EmptyState text="No hay datos de academia para este bloque." />
            ) : (
              academyTopCoursesRaw.map((course) => (
                <BarRow
                  key={course.courseId}
                  label={course.courseTitle}
                  value={number(Number(course.enrollments))}
                  ratio={clampPct(
                    percent(Number(course.enrollments), Number(academyTopCoursesRaw[0]?.enrollments || 1))
                  )}
                  color="#10b981"
                  note={`${number(Number(course.certificates))} certificados`}
                />
              ))
            )}
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <h4 className="text-xs uppercase tracking-widest text-white/40">Pass rate evaluaciones</h4>
              <div className="mt-3 space-y-2">
                <BarRow label="Tests de modulo" value={`${modulePassRate.toFixed(1)}%`} ratio={modulePassRate} color="#22c55e" note={`${number(moduleSubmissionsPassed)}/${number(moduleSubmissionsTotal)}`} />
                <BarRow label="Tests de curso" value={`${courseTestPassRate.toFixed(1)}%`} ratio={courseTestPassRate} color="#0ea5e9" note={`${number(courseTestSubmissionsPassed)}/${number(courseTestSubmissionsTotal)}`} />
                <BarRow label="Examen final" value={`${examPassRate.toFixed(1)}%`} ratio={examPassRate} color="#a855f7" note={`${number(examSubmissionsPassed)}/${number(examSubmissionsTotal)}`} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <h4 className="text-xs uppercase tracking-widest text-white/40">Dificultad real</h4>
              <div className="mt-3 space-y-2">
                <MiniStat label="Intentos prom. tests modulo" value={avgModuleAttempts.toFixed(2)} compact />
                <MiniStat label="Intentos prom. tests curso" value={avgCourseTestAttempts.toFixed(2)} compact />
                <MiniStat label="Score prom. modulo" value={`${avgModuleScore.toFixed(1)}%`} compact />
                <MiniStat label="Score prom. tests curso" value={`${avgCourseTestScore.toFixed(1)}%`} compact />
                <MiniStat label="Score prom. examen final" value={`${avgExamScore.toFixed(1)}%`} compact />
              </div>
            </div>
          </div>

          <div className="mt-7 space-y-3">
            <h4 className="text-xs uppercase tracking-widest text-white/40">Conversion por curso (website a compra)</h4>
            {topCourseConversion.length === 0 ? (
              <EmptyState text="No hay suficientes datos de visitantes/compras por curso." />
            ) : (
              topCourseConversion.map((course) => (
                <BarRow
                  key={`conv-${course.courseId}`}
                  label={course.courseTitle}
                  value={`${course.conversionRate.toFixed(2)}%`}
                  ratio={clampPct(course.conversionRate)}
                  color="#14b8a6"
                  note={`${number(course.purchases)} compras / ${number(course.uniqueVisitors)} visitantes`}
                />
              ))
            )}
          </div>
        </Panel>

        <Panel title="Usuarios y contenido" subtitle="Crecimiento de comunidad y estado del contenido marketing.">
          <div className="grid gap-4 md:grid-cols-2">
            <DonutCard title="Distribucion de roles" total={totalUsers} segments={usersDonutSegments} />
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <h4 className="text-xs uppercase tracking-widest text-white/40">Altas</h4>
              <div className="mt-3 space-y-2">
                <MiniStat label={`Nuevos en ${monthName}`} value={number(newUsersMonth)} compact />
                <MiniStat label="Nuevos ultima semana" value={number(newUsersWeek)} compact />
                <MiniStat label="Usuarios totales" value={number(totalUsers)} compact />
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <h4 className="text-xs uppercase tracking-widest text-white/40">Crecimiento (6 meses)</h4>
              <div className="mt-4 flex h-32 items-end gap-2">
                {monthlyUsers.map((m) => {
                  const h = Math.max(8, Math.round((m.total / maxMonthlyUsers) * 100));
                  return (
                    <div key={m.month.toISOString()} className="flex flex-1 flex-col items-center gap-1">
                      <div className="w-full rounded-t-md bg-gradient-to-t from-[#3b82f6]/40 to-[#3b82f6]" style={{ height: `${h}%` }} />
                      <span className="text-[10px] text-white/40">{monthLabel(m.month)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <h4 className="text-xs uppercase tracking-widest text-white/40">Contenido marketing</h4>
              <div className="mt-3 space-y-2">
                <MiniStat label="FAQs publicadas" value={number(faqCount)} compact />
                <MiniStat label="Imagenes de resultados" value={number(resultsCount)} compact />
                <MiniStat label="Testimonios activos" value={number(activeTestimonials)} compact />
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <Panel title="Calidad" subtitle="Incidencias de contenido y funcionalidad reportadas.">
          <div className="grid gap-4 md:grid-cols-2">
            <MiniStat label="Bugs totales" value={number(bugReportsTotal)} tone={bugReportsTotal > 0 ? "warn" : "default"} />
            <MiniStat label={`Bugs en ${monthName}`} value={number(bugReportsMonth)} tone={bugReportsMonth > 0 ? "warn" : "default"} />
          </div>
          <div className="mt-6 space-y-3">
            <BarRow
              label="Bugs de contenido"
              value={number(bugTypeMap.CONTENT)}
              ratio={clampPct(percent(bugTypeMap.CONTENT, Math.max(bugReportsMonth, 1)))}
              color="#f59e0b"
            />
            <BarRow
              label="Bugs de funcionalidad"
              value={number(bugTypeMap.FUNCTIONALITY)}
              ratio={clampPct(percent(bugTypeMap.FUNCTIONALITY, Math.max(bugReportsMonth, 1)))}
              color="#ef4444"
            />
          </div>
        </Panel>

        <Panel title="Enfoque activo" subtitle="Prioridades temporales del dashboard.">
          <div className="rounded-xl border border-[#f59e0b]/35 bg-[#f59e0b]/10 p-4 text-sm text-[#fde68a]">
            <p className="font-semibold">Modo Website + Academia</p>
            <p className="mt-1 text-[#fde68a]/90">
              Los bloques de citas y pagos se encuentran desactivados por decision operativa
              mientras esa parte se gestiona en otra plataforma.
            </p>
          </div>
          <div className="mt-5 space-y-2 text-sm text-white/65">
            <p>1. Crecimiento y calidad del trafico del sitio.</p>
            <p>2. Salud academica: matriculas, certificados y revisiones.</p>
            <p>3. Calidad de contenido/funcionalidad para no frenar conversion.</p>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur-xl">
      <h3 className="text-base font-semibold uppercase tracking-wider text-white/85">{title}</h3>
      {subtitle && <p className="mt-1.5 text-sm text-white/45">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </article>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "warn";
}) {
  const toneClass =
    tone === "accent"
      ? "border-[#646a40]/45 bg-[#646a40]/20"
      : tone === "warn"
      ? "border-[#f59e0b]/45 bg-[#f59e0b]/20"
      : "border-white/10 bg-white/5";

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wider text-white/50">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-white/50">{hint}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  compact = false,
  tone = "default",
}: {
  label: string;
  value: string;
  compact?: boolean;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${compact ? "" : "bg-black/20"} ${
        tone === "warn" ? "border-[#f59e0b]/35" : "border-white/10"
      }`}
    >
      <p className="text-[11px] uppercase tracking-wider text-white/45">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold ${tone === "warn" ? "text-[#fbbf24]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function BarRow({
  label,
  value,
  ratio,
  color,
  note,
}: {
  label: string;
  value: string;
  ratio: number;
  color: string;
  note?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <p className="truncate text-sm text-white/75">{label}</p>
        <div className="text-right">
          <p className="text-sm font-semibold text-white">{value}</p>
          {note ? <p className="text-[10px] text-white/40">{note}</p> : null}
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${clampPct(ratio)}%`,
            background: `linear-gradient(90deg, ${color}88 0%, ${color} 100%)`,
          }}
        />
      </div>
    </div>
  );
}

function DonutCard({
  title,
  total,
  segments,
}: {
  title: string;
  total: number;
  segments: Segment[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-widest text-white/40">{title}</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-24 w-24 rounded-full" style={{ background: buildDonutGradient(segments) }}>
          <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#171614]" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-2xl font-semibold text-white">{number(total)}</p>
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 truncate text-white/65">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                {segment.label}
              </span>
              <span className="text-white/70">{number(segment.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-8 text-center text-sm text-white/45">
      {text}
    </div>
  );
}
