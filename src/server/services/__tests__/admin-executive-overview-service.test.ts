import { db } from '@/lib/db'
import { parseAnalyticsDateRange } from '@/lib/analytics/date-range'
import { AdminExecutiveOverviewService } from '@/server/services/admin-executive-overview-service'

jest.mock('@/lib/db', () => ({
  db: {
    $queryRaw: jest.fn(),
    payment: { groupBy: jest.fn(), count: jest.fn() },
    examSubmission: { count: jest.fn() },
    courseTestSubmission: { count: jest.fn() },
  },
}))

const rangeResult = parseAnalyticsDateRange('2026-03-01', '2026-03-30')
if (!rangeResult.ok) throw new Error(rangeResult.error)
const range = rangeResult.value

describe('AdminExecutiveOverviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(db.$queryRaw as jest.Mock).mockResolvedValue([])
    ;(db.payment.count as jest.Mock).mockResolvedValue(0)
    ;(db.examSubmission.count as jest.Mock).mockResolvedValue(0)
    ;(db.courseTestSubmission.count as jest.Mock).mockResolvedValue(0)
  })

  it('keeps academy revenue separated by currency and fills empty traffic days', async () => {
    ;(db.payment.groupBy as jest.Mock).mockImplementation(({ where }) => {
      if (where.courseId) return Promise.resolve([])
      if (where.paidAt.gte === range.from) {
        return Promise.resolve([
          { currency: 'EUR', _count: { _all: 2 }, _sum: { amountCents: 5000 } },
          { currency: 'USD', _count: { _all: 1 }, _sum: { amountCents: 6200 } },
        ])
      }
      return Promise.resolve([
        { currency: 'EUR', _count: { _all: 1 }, _sum: { amountCents: 1500 } },
      ])
    })

    const snapshot = await AdminExecutiveOverviewService.getSnapshot(range)

    expect(snapshot.revenue).toEqual([
      expect.objectContaining({ currency: 'EUR', amountCents: 5000, previousAmountCents: 1500 }),
      expect.objectContaining({ currency: 'USD', amountCents: 6200, previousAmountCents: null }),
    ])
    expect(snapshot.purchases).toMatchObject({ value: 3, previous: 1, delta: 2, deltaPercent: 200 })
    expect(snapshot.traffic).toHaveLength(30)
    expect(snapshot.unavailableSections).toEqual([])
  })

  it('keeps the available overview sections visible when payment metrics fail', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(db.payment.groupBy as jest.Mock).mockRejectedValue(new Error('temporary payment aggregate failure'))

    const snapshot = await AdminExecutiveOverviewService.getSnapshot(range)

    expect(snapshot.unavailableSections).toContain('performance')
    expect(snapshot.traffic).toHaveLength(30)
    expect(snapshot.pendingReviews).toEqual({ total: 0, exams: 0, courseTests: 0 })
  })
})
