import { describe, expect, it } from 'vitest'

import {
  applyDiscount,
  calculateDiscountCents,
  isChargeable,
  normalizeDiscountCode,
  STRIPE_MINIMUM_CHARGE_CENTS,
} from '@/lib/discount'

describe('normalizeDiscountCode', () => {
  it('upper-cases and trims so a code typed by hand still matches', () => {
    expect(normalizeDiscountCode('  rizos20 ')).toBe('RIZOS20')
  })
})

describe('calculateDiscountCents', () => {
  it('takes a whole percentage off the base price', () => {
    expect(calculateDiscountCents(10_00, { type: 'PERCENT', value: 20 })).toBe(2_00)
  })

  it('rounds a percentage to whole cents', () => {
    // 33% of 10.01 is 330.33 cents, which Stripe cannot represent.
    expect(calculateDiscountCents(10_01, { type: 'PERCENT', value: 33 })).toBe(330)
  })

  it('takes a fixed amount off the base price', () => {
    expect(calculateDiscountCents(10_00, { type: 'FIXED', value: 2_50 })).toBe(2_50)
  })

  it('never discounts more than the price, so a total can never go negative', () => {
    expect(calculateDiscountCents(10_00, { type: 'FIXED', value: 50_00 })).toBe(10_00)
  })

  it('discounts nothing on a course that is already free', () => {
    expect(calculateDiscountCents(0, { type: 'PERCENT', value: 50 })).toBe(0)
    expect(calculateDiscountCents(0, { type: 'FIXED', value: 500 })).toBe(0)
  })
})

describe('applyDiscount', () => {
  it('reports the amount off and what is left to pay', () => {
    expect(applyDiscount(10_00, { type: 'PERCENT', value: 25 })).toEqual({
      discountCents: 2_50,
      netCents: 7_50,
    })
  })

  it('leaves nothing to pay when the code covers the whole price', () => {
    expect(applyDiscount(10_00, { type: 'PERCENT', value: 100 })).toEqual({
      discountCents: 10_00,
      netCents: 0,
    })
  })

  it('leaves nothing to pay when a fixed code exceeds the price', () => {
    expect(applyDiscount(5_00, { type: 'FIXED', value: 9_99 })).toEqual({
      discountCents: 5_00,
      netCents: 0,
    })
  })
})

describe('isChargeable', () => {
  it('rejects an amount below the payment gateway minimum', () => {
    expect(isChargeable(STRIPE_MINIMUM_CHARGE_CENTS - 1)).toBe(false)
  })

  it('accepts the minimum itself', () => {
    expect(isChargeable(STRIPE_MINIMUM_CHARGE_CENTS)).toBe(true)
  })

  it('rejects zero, which has to become a free enrolment instead of a charge', () => {
    expect(isChargeable(0)).toBe(false)
  })
})
