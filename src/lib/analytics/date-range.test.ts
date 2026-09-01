import { parseAnalyticsDateRange } from './date-range'

describe('parseAnalyticsDateRange', () => {
  it('uses an inclusive 30-day default period and an equal previous period', () => {
    const result = parseAnalyticsDateRange(undefined, undefined, new Date('2026-04-15T12:00:00.000Z'))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.fromKey).toBe('2026-03-17')
    expect(result.value.toKey).toBe('2026-04-15')
    expect(result.value.days).toBe(30)
    expect(result.value.previousFrom.toISOString()).toBe('2026-02-14T23:00:00.000Z')
    expect(result.value.previousTo.toISOString()).toBe('2026-03-16T22:59:59.999Z')
  })

  it('includes the complete last local day across the Madrid daylight-saving transition', () => {
    const result = parseAnalyticsDateRange('2026-03-29', '2026-03-30')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.from.toISOString()).toBe('2026-03-28T23:00:00.000Z')
    expect(result.value.to.toISOString()).toBe('2026-03-30T21:59:59.999Z')
    expect(result.value.days).toBe(2)
    expect(result.value.previousFrom.toISOString()).toBe('2026-03-26T23:00:00.000Z')
    expect(result.value.previousTo.toISOString()).toBe('2026-03-28T22:59:59.999Z')
  })

  it.each([
    ['2026-02-30', '2026-03-01'],
    ['2026-03-02', '2026-03-01'],
    ['2025-01-01', '2026-01-02'],
  ])('rejects invalid or unsupported ranges: %s → %s', (from, to) => {
    const result = parseAnalyticsDateRange(from, to)

    expect(result.ok).toBe(false)
  })
})
