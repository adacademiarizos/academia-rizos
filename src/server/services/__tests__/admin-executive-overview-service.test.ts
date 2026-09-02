import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { db } from '@/lib/db'
import { parseAnalyticsDateRange } from '@/lib/analytics/date-range'
import { AdminExecutiveOverviewService } from '@/server/services/admin-executive-overview-service'

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn(),
    payment: { groupBy: vi.fn(), count: vi.fn() },
    examSubmission: { count: vi.fn() },
    courseTestSubmission: { count: vi.fn() },
  },
}))

const rangeResult = parseAnalyticsDateRange('2026-03-01', '2026-03-30')
if (!rangeResult.ok) throw new Error(rangeResult.error)
const range = rangeResult.value

describe('AdminExecutiveOverviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(db.$queryRaw as Mock).mockResolvedValue([])
    ;(db.payment.count as Mock).mockResolvedValue(0)
    ;(db.examSubmission.count as Mock).mockResolvedValue(0)
    ;(db.courseTestSubmission.count as Mock).mockResolvedValue(0)
  })

  it('keeps academy revenue separated by currency and fills empty traffic days', async () => {
    ;(db.payment.groupBy as Mock).mockImplementation(({ where }) => {
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
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(db.payment.groupBy as Mock).mockRejectedValue(new Error('temporary payment aggregate failure'))

    const snapshot = await AdminExecutiveOverviewService.getSnapshot(range)

    expect(snapshot.unavailableSections).toContain('performance')
    expect(snapshot.traffic).toHaveLength(30)
    expect(snapshot.pendingReviews).toEqual({ total: 0, exams: 0, courseTests: 0 })
  })
})
