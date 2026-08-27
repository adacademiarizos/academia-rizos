/**
 * MarketingAnalyticsService
 * Aggregation queries for marketing analytics dashboard
 */

import { db } from '@/lib/db'

const VALID_GRANULARITY = ['day', 'week', 'month'] as const

type DateRange = { from: Date; to: Date }
type AnalyticsScope = 'all' | 'academy'

export class MarketingAnalyticsService {
  /**
   * Overview metrics: total views, sessions, conversions, conversion rate, revenue
   */
  static async getOverviewMetrics({ from, to }: DateRange, scope: AnalyticsScope = 'all') {
    if (scope === 'academy') {
      const [pageViewStats, coursePayments] = await Promise.all([
        db.$queryRaw<[{ total: bigint; sessions: bigint }]>`
          SELECT
            COUNT(*)::bigint AS total,
            COUNT(DISTINCT "sessionId")::bigint AS sessions
          FROM "PageView"
          WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        `,
        db.payment.aggregate({
          where: {
            type: 'COURSE',
            status: 'PAID',
            paidAt: { gte: from, lte: to },
          },
          _count: { _all: true },
          _sum: { amountCents: true },
        }),
      ])

      const totalViews = Number(pageViewStats[0]?.total ?? 0)
      const uniqueSessions = Number(pageViewStats[0]?.sessions ?? 0)
      const totalConversions = coursePayments._count._all
      const totalRevenueCents = coursePayments._sum.amountCents ?? 0
      const conversionRate = uniqueSessions > 0
        ? Math.round((totalConversions / uniqueSessions) * 10000) / 100
        : 0

      return { totalViews, uniqueSessions, totalConversions, conversionRate, totalRevenueCents }
    }

    const [pageViewStats, conversionStats] = await Promise.all([
      db.$queryRaw<[{ total: bigint; sessions: bigint }]>`
        SELECT
          COUNT(*)::bigint AS total,
          COUNT(DISTINCT "sessionId")::bigint AS sessions
        FROM "PageView"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      `,
      db.$queryRaw<[{ total: bigint; revenue: bigint }]>`
        SELECT
          COUNT(*)::bigint AS total,
          COALESCE(SUM("amountCents"), 0)::bigint AS revenue
        FROM "ConversionEvent"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      `,
    ])

    const totalViews = Number(pageViewStats[0]?.total ?? 0)
    const uniqueSessions = Number(pageViewStats[0]?.sessions ?? 0)
    const totalConversions = Number(conversionStats[0]?.total ?? 0)
    const totalRevenueCents = Number(conversionStats[0]?.revenue ?? 0)
    const conversionRate = uniqueSessions > 0
      ? Math.round((totalConversions / uniqueSessions) * 10000) / 100
      : 0

    return {
      totalViews,
      uniqueSessions,
      totalConversions,
      conversionRate,
      totalRevenueCents,
    }
  }

  /**
   * Traffic time series: views and sessions grouped by day/week/month
   */
  static async getTrafficTimeSeries(
    { from, to }: DateRange,
    granularity: 'day' | 'week' | 'month' = 'day'
  ) {
    // Validate granularity to prevent injection (even though Prisma parametrizes)
    const gran = VALID_GRANULARITY.includes(granularity) ? granularity : 'day'

    const data = await db.$queryRaw<Array<{ period: Date; views: bigint; sessions: bigint }>>`
      SELECT
        date_trunc(${gran}, "createdAt") AS period,
        COUNT(*)::bigint AS views,
        COUNT(DISTINCT "sessionId")::bigint AS sessions
      FROM "PageView"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY period
      ORDER BY period ASC
    `

    return data.map((row) => ({
      date: row.period.toISOString().split('T')[0],
      views: Number(row.views),
      sessions: Number(row.sessions),
    }))
  }

  /**
   * Traffic sources: breakdown by UTM source or referrer domain
   */
  static async getTrafficSources({ from, to }: DateRange) {
    const data = await db.$queryRaw<Array<{ source: string; views: bigint; sessions: bigint }>>`
      SELECT
        COALESCE(
          "utmSource",
          CASE
            WHEN "referrer" IS NULL OR "referrer" = '' THEN 'Directo'
            ELSE SUBSTRING("referrer" FROM '://([^/]+)')
          END
        ) AS source,
        COUNT(*)::bigint AS views,
        COUNT(DISTINCT "sessionId")::bigint AS sessions
      FROM "PageView"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY source
      ORDER BY views DESC
      LIMIT 20
    `

    // Get conversions per source
    const conversions = await db.$queryRaw<Array<{ source: string; count: bigint; revenue: bigint }>>`
      SELECT
        COALESCE(
          "utmSource",
          CASE
            WHEN "referrer" IS NULL OR "referrer" = '' THEN 'Directo'
            ELSE SUBSTRING("referrer" FROM '://([^/]+)')
          END
        ) AS source,
        COUNT(*)::bigint AS count,
        COALESCE(SUM("amountCents"), 0)::bigint AS revenue
      FROM "ConversionEvent"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY source
    `

    const convMap = new Map(
      conversions.map((c) => [c.source, { count: Number(c.count), revenue: Number(c.revenue) }])
    )

    return data.map((row) => ({
      source: row.source || 'Directo',
      views: Number(row.views),
      sessions: Number(row.sessions),
      conversions: convMap.get(row.source)?.count ?? 0,
      revenueCents: convMap.get(row.source)?.revenue ?? 0,
    }))
  }

  /**
   * Top pages by views
   */
  static async getTopPages({ from, to }: DateRange, limit = 20) {
    const data = await db.$queryRaw<Array<{ path: string; views: bigint; sessions: bigint }>>`
      SELECT
        "path",
        COUNT(*)::bigint AS views,
        COUNT(DISTINCT "sessionId")::bigint AS sessions
      FROM "PageView"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY "path"
      ORDER BY views DESC
      LIMIT ${limit}
    `

    return data.map((row) => ({
      path: row.path,
      views: Number(row.views),
      sessions: Number(row.sessions),
    }))
  }

  /**
   * UTM campaign performance
   */
  static async getCampaignPerformance({ from, to }: DateRange) {
    const data = await db.$queryRaw<Array<{
      campaign: string | null
      source: string | null
      medium: string | null
      views: bigint
      sessions: bigint
    }>>`
      SELECT
        "utmCampaign" AS campaign,
        "utmSource" AS source,
        "utmMedium" AS medium,
        COUNT(*)::bigint AS views,
        COUNT(DISTINCT "sessionId")::bigint AS sessions
      FROM "PageView"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND ("utmCampaign" IS NOT NULL OR "utmSource" IS NOT NULL)
      GROUP BY "utmCampaign", "utmSource", "utmMedium"
      ORDER BY views DESC
    `

    // Get conversions per campaign
    const conversions = await db.$queryRaw<Array<{
      campaign: string | null
      source: string | null
      count: bigint
      revenue: bigint
    }>>`
      SELECT
        "utmCampaign" AS campaign,
        "utmSource" AS source,
        COUNT(*)::bigint AS count,
        COALESCE(SUM("amountCents"), 0)::bigint AS revenue
      FROM "ConversionEvent"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND ("utmCampaign" IS NOT NULL OR "utmSource" IS NOT NULL)
      GROUP BY "utmCampaign", "utmSource"
    `

    const convMap = new Map(
      conversions.map((c) => [
        `${c.campaign || ''}__${c.source || ''}`,
        { count: Number(c.count), revenue: Number(c.revenue) },
      ])
    )

    return data.map((row) => {
      const key = `${row.campaign || ''}__${row.source || ''}`
      return {
        campaign: row.campaign || '(sin campaña)',
        source: row.source || '(sin fuente)',
        medium: row.medium || '(sin medio)',
        views: Number(row.views),
        sessions: Number(row.sessions),
        conversions: convMap.get(key)?.count ?? 0,
        revenueCents: convMap.get(key)?.revenue ?? 0,
      }
    })
  }

  /**
   * Conversion funnel: visitors -> course page -> checkout -> purchase
   */
  static async getConversionFunnel({ from, to }: DateRange, scope: AnalyticsScope = 'all') {
    const [
      totalVisitors,
      coursePageVisitors,
      purchases,
      bookings,
      registrations,
    ] = await Promise.all([
      db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT "sessionId")::bigint AS count
        FROM "PageView"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      `,
      db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT "sessionId")::bigint AS count
        FROM "PageView"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          AND "path" LIKE '/courses/%'
      `,
      db.payment.count({
        where: {
          type: 'COURSE',
          status: 'PAID',
          paidAt: { gte: from, lte: to },
        },
      }),
      scope === 'academy' ? Promise.resolve(0) : db.conversionEvent.count({
        where: { type: 'BOOKING', createdAt: { gte: from, lte: to } },
      }),
      scope === 'academy' ? Promise.resolve(0) : db.conversionEvent.count({
        where: { type: 'REGISTRATION', createdAt: { gte: from, lte: to } },
      }),
    ])

    return {
      totalVisitors: Number(totalVisitors[0]?.count ?? 0),
      coursePageVisitors: Number(coursePageVisitors[0]?.count ?? 0),
      purchases,
      bookings,
      registrations,
    }
  }

  /**
   * Geographic data: views by country and city
   */
  static async getGeographicData({ from, to }: DateRange) {
    const data = await db.$queryRaw<Array<{
      country: string | null
      city: string | null
      views: bigint
      sessions: bigint
    }>>`
      SELECT
        COALESCE("country", 'Desconocido') AS country,
        "city",
        COUNT(*)::bigint AS views,
        COUNT(DISTINCT "sessionId")::bigint AS sessions
      FROM "PageView"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY "country", "city"
      ORDER BY views DESC
      LIMIT 50
    `

    return data.map((row) => ({
      country: row.country || 'Desconocido',
      city: row.city || null,
      views: Number(row.views),
      sessions: Number(row.sessions),
    }))
  }

  /**
   * Device breakdown: device type, browser, OS
   */
  static async getDeviceBreakdown({ from, to }: DateRange) {
    const [devices, browsers, operatingSystems] = await Promise.all([
      db.$queryRaw<Array<{ type: string; count: bigint }>>`
        SELECT COALESCE("deviceType", 'unknown') AS type, COUNT(*)::bigint AS count
        FROM "PageView"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        GROUP BY "deviceType" ORDER BY count DESC
      `,
      db.$queryRaw<Array<{ name: string; count: bigint }>>`
        SELECT COALESCE("browser", 'Other') AS name, COUNT(*)::bigint AS count
        FROM "PageView"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        GROUP BY "browser" ORDER BY count DESC
      `,
      db.$queryRaw<Array<{ name: string; count: bigint }>>`
        SELECT COALESCE("os", 'Other') AS name, COUNT(*)::bigint AS count
        FROM "PageView"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        GROUP BY "os" ORDER BY count DESC
      `,
    ])

    return {
      devices: devices.map((d) => ({ type: d.type, count: Number(d.count) })),
      browsers: browsers.map((b) => ({ name: b.name, count: Number(b.count) })),
      os: operatingSystems.map((o) => ({ name: o.name, count: Number(o.count) })),
    }
  }

  /**
   * Course-specific analytics: page views, purchases, revenue per course
   */
  static async getCourseAnalytics({ from, to }: DateRange) {
    // Get all active courses
    const courses = await db.course.findMany({
      where: { isActive: true },
      select: { id: true, title: true },
    })

    // Get course page views
    const pageViews = await db.$queryRaw<Array<{ course_id: string; views: bigint; sessions: bigint }>>`
      SELECT
        split_part("path", '/', 3) AS course_id,
        COUNT(*)::bigint AS views,
        COUNT(DISTINCT "sessionId")::bigint AS sessions
      FROM "PageView"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND "path" LIKE '/courses/%'
      GROUP BY course_id
    `

    // Payments are the financial source of truth. Keep currencies separate rather
    // than adding amounts that cannot be compared safely.
    const payments = await db.$queryRaw<Array<{ course_id: string; currency: string; count: bigint; revenue: bigint }>>`
      SELECT
        "courseId" AS course_id,
        "currency" AS currency,
        COUNT(*)::bigint AS count,
        COALESCE(SUM("amountCents"), 0)::bigint AS revenue
      FROM "Payment"
      WHERE "type" = 'COURSE'
        AND "status" = 'PAID'
        AND "paidAt" >= ${from} AND "paidAt" <= ${to}
        AND "courseId" IS NOT NULL
      GROUP BY "courseId", "currency"
    `

    // The query groups by course ID, so one session is not counted twice when
    // it sees both a course overview and one of its nested pages.
    const viewMap = new Map<string, { views: number; sessions: number }>()
    for (const pv of pageViews) {
      viewMap.set(pv.course_id, { views: Number(pv.views), sessions: Number(pv.sessions) })
    }

    const paymentsByCourse = new Map<string, Array<{ currency: string; purchases: number; amountCents: number }>>()
    for (const payment of payments) {
      const entries = paymentsByCourse.get(payment.course_id) ?? []
      entries.push({
        currency: payment.currency,
        purchases: Number(payment.count),
        amountCents: Number(payment.revenue),
      })
      paymentsByCourse.set(payment.course_id, entries)
    }

    return courses.map((course) => {
      const views = viewMap.get(course.id)?.views ?? 0
      const sessions = viewMap.get(course.id)?.sessions ?? 0
      const revenue = paymentsByCourse.get(course.id) ?? []
      const purchases = revenue.reduce((total, item) => total + item.purchases, 0)

      return {
        courseId: course.id,
        courseTitle: course.title,
        pageViews: views,
        uniqueVisitors: sessions,
        purchases,
        revenue,
        conversionRate: sessions > 0
          ? Math.round((purchases / sessions) * 10000) / 100
          : 0,
      }
    }).sort((a, b) => b.pageViews - a.pageViews)
  }

  /**
   * Referrer domain breakdown
   */
  static async getReferrerBreakdown({ from, to }: DateRange) {
    const data = await db.$queryRaw<Array<{ domain: string; views: bigint }>>`
      SELECT
        CASE
          WHEN "referrer" IS NULL OR "referrer" = '' THEN 'Directo'
          ELSE COALESCE(SUBSTRING("referrer" FROM '://([^/]+)'), 'Directo')
        END AS domain,
        COUNT(*)::bigint AS views
      FROM "PageView"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY domain
      ORDER BY views DESC
      LIMIT 20
    `

    return data.map((row) => ({
      domain: row.domain,
      views: Number(row.views),
    }))
  }
}
