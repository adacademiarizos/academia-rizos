import { db } from "@/lib/db";
import type { AnalyticsDateRange } from "@/lib/analytics/date-range";

type CountRow = { total: bigint };
type FunnelRow = { sessions: bigint; coursePageSessions: bigint };
type TrafficRow = { day: string; sessions: bigint };
type PurchaseRow = { day: string; purchases: bigint };
type RetentionRow = { enrollments: bigint; retained: bigint };
type ProgressRow = { completionRate: number | null };
type CertificateLeadRow = { medianDays: number | null };
type TopCourseRow = {
  courseId: string;
  courseTitle: string;
  purchases: bigint;
  certificates: bigint;
  uniqueVisitors: bigint;
};

type PaymentSummary = {
  currency: string;
  purchases: number;
  revenueCents: number;
};

export type OverviewMetric = {
  value: number;
  previous: number | null;
  delta: number | null;
  deltaPercent: number | null;
};

export type CurrencyRevenueMetric = {
  currency: string;
  amountCents: number;
  previousAmountCents: number | null;
  deltaPercent: number | null;
};

export type ExecutiveOverviewSnapshot = {
  range: Pick<AnalyticsDateRange, "fromKey" | "toKey" | "days">;
  revenue: CurrencyRevenueMetric[];
  purchases: OverviewMetric;
  conversionRate: OverviewMetric;
  activeLearners: OverviewMetric;
  funnel: {
    sessions: number;
    coursePageSessions: number;
    purchases: number;
  };
  traffic: Array<{ date: string; sessions: number; purchases: number }>;
  academyHealth: {
    retention30: number | null;
    retentionCohortSize: number;
    progressRate: number | null;
    medianCertificationDays: number | null;
  };
  topCourses: Array<{
    courseId: string;
    title: string;
    purchases: number;
    revenue: Array<{ currency: string; amountCents: number }>;
    certificates: number;
    conversionRate: number | null;
  }>;
  pendingReviews: {
    total: number;
    exams: number;
    courseTests: number;
  };
  unavailableSections: Array<"performance" | "traffic" | "academyHealth" | "courses" | "reviews">;
};

type SafeResult<T> = { data: T; failed: false } | { data: null; failed: true };

function asNumber(value: bigint | number | null | undefined) {
  return Number(value ?? 0);
}

function calculateMetric(current: number, previous: number): OverviewMetric {
  if (previous === 0) {
    return { value: current, previous: null, delta: null, deltaPercent: null };
  }

  const delta = current - previous;
  return {
    value: current,
    previous,
    delta,
    deltaPercent: Math.round((delta / previous) * 10_000) / 100,
  };
}

function calendarDays(fromKey: string, toKey: string) {
  const result: string[] = [];
  const date = new Date(`${fromKey}T00:00:00.000Z`);
  const finalDate = new Date(`${toKey}T00:00:00.000Z`);

  while (date <= finalDate) {
    result.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return result;
}

async function safely<T>(section: ExecutiveOverviewSnapshot["unavailableSections"][number], operation: Promise<T>): Promise<SafeResult<T>> {
  try {
    return { data: await operation, failed: false };
  } catch (error) {
    console.error(`[admin-overview] ${section} unavailable`, error);
    return { data: null, failed: true };
  }
}

async function getPaymentSummary(range: Pick<AnalyticsDateRange, "from" | "to">): Promise<PaymentSummary[]> {
  const rows = await db.payment.groupBy({
    by: ["currency"],
    where: {
      type: "COURSE",
      status: "PAID",
      paidAt: { gte: range.from, lte: range.to },
    },
    _count: { _all: true },
    _sum: { amountCents: true },
  });

  return rows.map((row) => ({
    currency: row.currency,
    purchases: row._count._all,
    revenueCents: row._sum.amountCents ?? 0,
  }));
}

async function getFunnel(range: Pick<AnalyticsDateRange, "from" | "to">) {
  const [traffic] = await db.$queryRaw<FunnelRow[]>`
    SELECT
      COUNT(DISTINCT "sessionId")::bigint AS sessions,
      COUNT(DISTINCT "sessionId") FILTER (WHERE "path" LIKE '/courses/%')::bigint AS "coursePageSessions"
    FROM "PageView"
    WHERE "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}
  `;

  const purchases = await db.payment.count({
    where: {
      type: "COURSE",
      status: "PAID",
      paidAt: { gte: range.from, lte: range.to },
    },
  });

  return {
    sessions: asNumber(traffic?.sessions),
    coursePageSessions: asNumber(traffic?.coursePageSessions),
    purchases,
  };
}

async function getActiveLearners(range: Pick<AnalyticsDateRange, "from" | "to">) {
  const [row] = await db.$queryRaw<CountRow[]>`
    SELECT COUNT(DISTINCT activity."userId")::bigint AS total
    FROM (
      SELECT "userId"
      FROM "UserActivity"
      WHERE "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}
      UNION
      SELECT "userId"
      FROM "PageView"
      WHERE "userId" IS NOT NULL
        AND "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}
        AND ("path" LIKE '/learn/%' OR "path" LIKE '/courses/%')
    ) AS activity
    WHERE activity."userId" IS NOT NULL
  `;

  return asNumber(row?.total);
}

async function getTraffic(range: AnalyticsDateRange) {
  const [trafficRows, purchaseRows] = await Promise.all([
    db.$queryRaw<TrafficRow[]>`
      SELECT
        TO_CHAR(
          date_trunc('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${range.timeZone}),
          'YYYY-MM-DD'
        ) AS day,
        COUNT(DISTINCT "sessionId")::bigint AS sessions
      FROM "PageView"
      WHERE "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}
      GROUP BY day
      ORDER BY day ASC
    `,
    db.$queryRaw<PurchaseRow[]>`
      SELECT
        TO_CHAR(
          date_trunc('day', ("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${range.timeZone}),
          'YYYY-MM-DD'
        ) AS day,
        COUNT(*)::bigint AS purchases
      FROM "Payment"
      WHERE type = 'COURSE'
        AND status = 'PAID'
        AND "paidAt" >= ${range.from} AND "paidAt" <= ${range.to}
      GROUP BY day
      ORDER BY day ASC
    `,
  ]);

  const sessionsByDate = new Map(trafficRows.map((row) => [row.day, asNumber(row.sessions)]));
  const purchasesByDate = new Map(purchaseRows.map((row) => [row.day, asNumber(row.purchases)]));

  return calendarDays(range.fromKey, range.toKey).map((date) => ({
    date,
    sessions: sessionsByDate.get(date) ?? 0,
    purchases: purchasesByDate.get(date) ?? 0,
  }));
}

async function getAcademyHealth(range: AnalyticsDateRange) {
  const matureCohortFrom = new Date(range.from.getTime() - 30 * 24 * 60 * 60 * 1000);
  const matureCohortTo = new Date(range.to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [retentionRows, progressRows, certificationRows] = await Promise.all([
    db.$queryRaw<RetentionRow[]>`
      SELECT
        COUNT(*)::bigint AS enrollments,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM "UserActivity" ua
            WHERE ua."userId" = ca."userId"
              AND ua."createdAt" >= ca."createdAt"
              AND ua."createdAt" <= ca."createdAt" + interval '30 days'
              AND (ua."courseId" = ca."courseId" OR ua."courseId" IS NULL)
          )
          OR EXISTS (
            SELECT 1
            FROM "PageView" pv
            WHERE pv."userId" = ca."userId"
              AND pv."createdAt" >= ca."createdAt"
              AND pv."createdAt" <= ca."createdAt" + interval '30 days'
              AND (pv."path" LIKE '/learn/%' OR pv."path" LIKE '/courses/%')
          )
        )::bigint AS retained
      FROM "CourseAccess" ca
      WHERE ca."createdAt" >= ${matureCohortFrom}
        AND ca."createdAt" <= ${matureCohortTo}
    `,
    db.$queryRaw<ProgressRow[]>`
      SELECT
        (
          COUNT(mp.id) FILTER (WHERE mp.completed = true)::double precision
          / NULLIF(COUNT(m.id), 0)
        ) * 100 AS "completionRate"
      FROM "CourseAccess" ca
      INNER JOIN "Module" m ON m."courseId" = ca."courseId"
      LEFT JOIN "ModuleProgress" mp
        ON mp."moduleId" = m.id
        AND mp."userId" = ca."userId"
      WHERE ca."accessUntil" IS NULL OR ca."accessUntil" > ${range.to}
    `,
    db.$queryRaw<CertificateLeadRow[]>`
      SELECT
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (cert."issuedAt" - ca."createdAt")) / 86400.0
        )::double precision AS "medianDays"
      FROM "Certificate" cert
      INNER JOIN "CourseAccess" ca
        ON ca."courseId" = cert."courseId"
        AND ca."userId" = cert."userId"
      WHERE cert.valid = true
        AND cert."issuedAt" >= ${range.from} AND cert."issuedAt" <= ${range.to}
    `,
  ]);

  const enrollmentCount = asNumber(retentionRows[0]?.enrollments);
  const retained = asNumber(retentionRows[0]?.retained);

  return {
    retention30: enrollmentCount > 0 ? Math.round((retained / enrollmentCount) * 10_000) / 100 : null,
    retentionCohortSize: enrollmentCount,
    progressRate: progressRows[0]?.completionRate == null ? null : Math.round(progressRows[0].completionRate * 100) / 100,
    medianCertificationDays:
      certificationRows[0]?.medianDays == null ? null : Math.round(certificationRows[0].medianDays * 10) / 10,
  };
}

async function getTopCourses(range: Pick<AnalyticsDateRange, "from" | "to">) {
  const rows = await db.$queryRaw<TopCourseRow[]>`
    SELECT
      course.id AS "courseId",
      course.title AS "courseTitle",
      COUNT(payment.id)::bigint AS purchases,
      (
        SELECT COUNT(*)::bigint
        FROM "Certificate" certificate
        WHERE certificate."courseId" = course.id
          AND certificate.valid = true
          AND certificate."issuedAt" >= ${range.from} AND certificate."issuedAt" <= ${range.to}
      ) AS certificates,
      (
        SELECT COUNT(DISTINCT page_view."sessionId")::bigint
        FROM "PageView" page_view
        WHERE (
          page_view."path" = '/courses/' || course.id
          OR page_view."path" LIKE '/courses/' || course.id || '/%'
        )
          AND page_view."createdAt" >= ${range.from} AND page_view."createdAt" <= ${range.to}
      ) AS "uniqueVisitors"
    FROM "Payment" payment
    INNER JOIN "Course" course ON course.id = payment."courseId"
    WHERE payment.type = 'COURSE'
      AND payment.status = 'PAID'
      AND payment."paidAt" >= ${range.from} AND payment."paidAt" <= ${range.to}
    GROUP BY course.id, course.title
    ORDER BY purchases DESC, course.title ASC
    LIMIT 3
  `;

  if (rows.length === 0) return [];

  const revenueRows = await db.payment.groupBy({
    by: ["courseId", "currency"],
    where: {
      courseId: { in: rows.map((row) => row.courseId) },
      type: "COURSE",
      status: "PAID",
      paidAt: { gte: range.from, lte: range.to },
    },
    _sum: { amountCents: true },
  });

  const revenueByCourse = new Map<string, Array<{ currency: string; amountCents: number }>>();
  for (const revenue of revenueRows) {
    if (!revenue.courseId) continue;
    const values = revenueByCourse.get(revenue.courseId) ?? [];
    values.push({ currency: revenue.currency, amountCents: revenue._sum.amountCents ?? 0 });
    revenueByCourse.set(revenue.courseId, values);
  }

  return rows.map((row) => {
    const purchases = asNumber(row.purchases);
    const uniqueVisitors = asNumber(row.uniqueVisitors);
    return {
      courseId: row.courseId,
      title: row.courseTitle,
      purchases,
      revenue: revenueByCourse.get(row.courseId) ?? [],
      certificates: asNumber(row.certificates),
      conversionRate: uniqueVisitors > 0 ? Math.round((purchases / uniqueVisitors) * 10_000) / 100 : null,
    };
  });
}

async function getPendingReviews() {
  const [exams, courseTests] = await Promise.all([
    db.examSubmission.count({ where: { status: "PENDING" } }),
    db.courseTestSubmission.count({
      where: { status: "PENDING", courseTest: { isFinalExam: true } },
    }),
  ]);

  return { total: exams + courseTests, exams, courseTests };
}

export class AdminExecutiveOverviewService {
  static async getSnapshot(range: AnalyticsDateRange): Promise<ExecutiveOverviewSnapshot> {
    const [currentPayments, previousPayments, currentFunnel, previousFunnel, currentLearners, previousLearners, traffic, academyHealth, topCourses, pendingReviews] =
      await Promise.all([
        safely("performance", getPaymentSummary(range)),
        safely("performance", getPaymentSummary({ from: range.previousFrom, to: range.previousTo })),
        safely("performance", getFunnel(range)),
        safely("performance", getFunnel({ from: range.previousFrom, to: range.previousTo })),
        safely("performance", getActiveLearners(range)),
        safely("performance", getActiveLearners({ from: range.previousFrom, to: range.previousTo })),
        safely("traffic", getTraffic(range)),
        safely("academyHealth", getAcademyHealth(range)),
        safely("courses", getTopCourses(range)),
        safely("reviews", getPendingReviews()),
      ]);

    const unavailableSections = new Set<ExecutiveOverviewSnapshot["unavailableSections"][number]>();
    if (currentPayments.failed || previousPayments.failed || currentFunnel.failed || previousFunnel.failed || currentLearners.failed || previousLearners.failed) {
      unavailableSections.add("performance");
    }
    if (traffic.failed) unavailableSections.add("traffic");
    if (academyHealth.failed) unavailableSections.add("academyHealth");
    if (topCourses.failed) unavailableSections.add("courses");
    if (pendingReviews.failed) unavailableSections.add("reviews");

    const currentPaymentRows = currentPayments.data ?? [];
    const previousPaymentRows = previousPayments.data ?? [];
    const currentPaymentsByCurrency = new Map(currentPaymentRows.map((row) => [row.currency, row]));
    const previousPaymentsByCurrency = new Map(previousPaymentRows.map((row) => [row.currency, row]));
    const currencies = new Set([...currentPaymentsByCurrency.keys(), ...previousPaymentsByCurrency.keys()]);
    const revenue = Array.from(currencies).map((currency) => {
      const current = currentPaymentsByCurrency.get(currency);
      const previous = previousPaymentsByCurrency.get(currency);
      const amountCents = current?.revenueCents ?? 0;
      const previousAmountCents = previous?.revenueCents ?? null;
      return {
        currency,
        amountCents,
        previousAmountCents,
        deltaPercent:
          previousAmountCents && previousAmountCents > 0
            ? Math.round(((amountCents - previousAmountCents) / previousAmountCents) * 10_000) / 100
            : null,
      };
    });

    const currentPurchaseCount = currentPaymentRows.reduce((total, row) => total + row.purchases, 0);
    const previousPurchaseCount = previousPaymentRows.reduce((total, row) => total + row.purchases, 0);
    const currentFunnelData = currentFunnel.data ?? { sessions: 0, coursePageSessions: 0, purchases: currentPurchaseCount };
    const previousFunnelData = previousFunnel.data ?? { sessions: 0, coursePageSessions: 0, purchases: previousPurchaseCount };
    const currentConversion = currentFunnelData.sessions > 0 ? (currentPurchaseCount / currentFunnelData.sessions) * 100 : 0;
    const previousConversion = previousFunnelData.sessions > 0 ? (previousPurchaseCount / previousFunnelData.sessions) * 100 : 0;

    return {
      range: { fromKey: range.fromKey, toKey: range.toKey, days: range.days },
      revenue,
      purchases: calculateMetric(currentPurchaseCount, previousPurchaseCount),
      conversionRate: calculateMetric(Math.round(currentConversion * 100) / 100, Math.round(previousConversion * 100) / 100),
      activeLearners: calculateMetric(currentLearners.data ?? 0, previousLearners.data ?? 0),
      funnel: {
        ...currentFunnelData,
        purchases: currentPurchaseCount,
      },
      traffic: traffic.data ?? [],
      academyHealth: academyHealth.data ?? {
        retention30: null,
        retentionCohortSize: 0,
        progressRate: null,
        medianCertificationDays: null,
      },
      topCourses: topCourses.data ?? [],
      pendingReviews: pendingReviews.data ?? { total: 0, exams: 0, courseTests: 0 },
      unavailableSections: Array.from(unavailableSections),
    };
  }
}
