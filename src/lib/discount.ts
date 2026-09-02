import type { DiscountType } from '@prisma/client'

/**
 * Codes are typed by hand on a phone as often as pasted, so they are compared
 * case-insensitively and without surrounding whitespace. Storing the normalised
 * form is what makes the unique index meaningful.
 */
export function normalizeDiscountCode(code: string) {
  return code.trim().toUpperCase()
}

export type DiscountRule = {
  type: DiscountType
  value: number
}

/**
 * The amount a rule takes off a base price, in cents.
 *
 * Clamped to the base price so a fixed discount larger than the course can
 * never produce a negative total, and rounded to whole cents because Stripe
 * has no sub-cent amounts.
 */
export function calculateDiscountCents(baseCents: number, rule: DiscountRule) {
  if (baseCents <= 0) return 0

  const raw = rule.type === 'PERCENT'
    ? Math.round((baseCents * rule.value) / 100)
    : rule.value

  return Math.max(0, Math.min(baseCents, raw))
}

/** The base price left after a rule is applied. Never negative. */
export function applyDiscount(baseCents: number, rule: DiscountRule) {
  const discountCents = calculateDiscountCents(baseCents, rule)
  return { discountCents, netCents: baseCents - discountCents }
}

/**
 * Stripe rejects charges below its minimum (50 cents for EUR), so anything at
 * or under it that is not exactly zero cannot be collected. A course is either
 * chargeable or it is given away — there is no third option.
 */
export const STRIPE_MINIMUM_CHARGE_CENTS = 50

export function isChargeable(totalCents: number) {
  return totalCents >= STRIPE_MINIMUM_CHARGE_CENTS
}

export type DiscountRejectionReason =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'ALREADY_USED'
  | 'WRONG_COURSE'

export const DISCOUNT_REJECTION_MESSAGES: Record<DiscountRejectionReason, string> = {
  NOT_FOUND: 'Este código no existe.',
  INACTIVE: 'Este código ya no está activo.',
  EXPIRED: 'Este código ya venció.',
  EXHAUSTED: 'Este código alcanzó su límite de usos.',
  ALREADY_USED: 'Ya usaste este código.',
  WRONG_COURSE: 'Este código no aplica a este curso.',
}
