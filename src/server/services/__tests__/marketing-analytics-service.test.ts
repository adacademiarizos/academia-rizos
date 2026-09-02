import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { db } from '@/lib/db'
import { MarketingAnalyticsService } from '@/server/services/marketing-analytics-service'

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn(),
    course: { findMany: vi.fn() },
    payment: { count: vi.fn() },
    conversionEvent: { count: vi.fn() },
  },
}))

function queryText(query: TemplateStringsArray | { strings?: TemplateStringsArray }) {
  if (Array.isArray(query)) return query.join(' ')
  return query.strings?.join(' ') ?? ''
}

describe('MarketingAnalyticsService', () => {
  const range = {
    from: new Date('2026-03-01T00:00:00.000Z'),
    to: new Date('2026-03-31T23:59:59.999Z'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns course revenue from confirmed course payments and keeps currencies separate', async () => {
    ;(db.course.findMany as Mock).mockResolvedValue([
      { id: 'course-a', title: 'Definición' },
      { id: 'course-b', title: 'Hidratación' },
    ])
    ;(db.$queryRaw as Mock).mockImplementation((query: TemplateStringsArray | { strings?: TemplateStringsArray }) => {
      const sql = queryText(query)
      if (sql.includes('FROM "PageView"')) {
        return Promise.resolve([{ course_id: 'course-a', views: 10n, sessions: 8n }])
      }
      if (sql.includes('FROM "Payment"')) {
        return Promise.resolve([
          { course_id: 'course-a', currency: 'EUR', count: 2n, revenue: 5000n },
          { course_id: 'course-a', currency: 'USD', count: 1n, revenue: 6200n },
        ])
      }
      throw new Error(`Unexpected analytics query: ${sql}`)
    })

    const result = await MarketingAnalyticsService.getCourseAnalytics(range)

    expect(result[0]).toMatchObject({
      courseId: 'course-a',
      purchases: 3,
      conversionRate: 37.5,
      revenue: [
        { currency: 'EUR', amountCents: 5000 },
        { currency: 'USD', amountCents: 6200 },
      ],
    })
    expect(result[1]).toMatchObject({ courseId: 'course-b', purchases: 0, revenue: [] })

    const paymentQuery = (db.$queryRaw as Mock).mock.calls
      .map(([query]) => queryText(query))
      .find((sql) => sql.includes('FROM "Payment"'))
    expect(paymentQuery).toContain('"type" = \'COURSE\'')
    expect(paymentQuery).toContain('"status" = \'PAID\'')
    expect(paymentQuery).toContain('"paidAt"')
  })

  it('excludes salon conversion events from the academy funnel', async () => {
    ;(db.$queryRaw as Mock).mockResolvedValueOnce([{ count: 20n }]).mockResolvedValueOnce([{ count: 7n }])
    ;(db.payment.count as Mock).mockResolvedValue(3)

    const funnel = await MarketingAnalyticsService.getConversionFunnel(range, 'academy')

    expect(funnel).toEqual({
      totalVisitors: 20,
      coursePageVisitors: 7,
      purchases: 3,
      bookings: 0,
      registrations: 0,
    })
    expect(db.conversionEvent.count).not.toHaveBeenCalled()
    expect(db.payment.count).toHaveBeenCalledWith({
      where: {
        type: 'COURSE',
        status: 'PAID',
        paidAt: { gte: range.from, lte: range.to },
      },
    })
  })
})
