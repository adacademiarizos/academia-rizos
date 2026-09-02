/**
 * Validation and redemption of discount codes.
 *
 * Validation is deliberately separate from redemption: the course page needs to
 * price a code live, long before anyone commits to buying. Only checkout
 * redeems, and redemption is the point at which the one-use-per-person rule and
 * the global cap are actually enforced by the database rather than by a read.
 */

import type { DiscountCode, Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import {
  applyDiscount,
  calculateDiscountCents,
  normalizeDiscountCode,
  type DiscountRejectionReason,
} from '@/lib/discount'

export type DiscountValidation =
  | { ok: true; code: DiscountCode; discountCents: number; netCents: number }
  | { ok: false; reason: DiscountRejectionReason }

type PrismaClientLike = Prisma.TransactionClient | typeof db

export class DiscountService {
  /**
   * Prices a code against a course for one user without consuming anything.
   * Every rejection is reported as a reason so the caller can show the student
   * why the code did not apply rather than a generic failure.
   */
  static async validate(input: {
    code: string
    courseId: string
    userId: string
    baseCents: number
    client?: PrismaClientLike
  }): Promise<DiscountValidation> {
    const client = input.client ?? db
    const code = await client.discountCode.findUnique({
      where: { code: normalizeDiscountCode(input.code) },
    })

    if (!code) return { ok: false, reason: 'NOT_FOUND' }
    if (!code.isActive) return { ok: false, reason: 'INACTIVE' }
    if (code.expiresAt && code.expiresAt <= new Date()) return { ok: false, reason: 'EXPIRED' }
    if (code.courseId && code.courseId !== input.courseId) {
      return { ok: false, reason: 'WRONG_COURSE' }
    }
    if (code.maxRedemptions !== null && code.redemptions >= code.maxRedemptions) {
      return { ok: false, reason: 'EXHAUSTED' }
    }

    const alreadyUsed = await client.discountRedemption.findUnique({
      where: { discountCodeId_userId: { discountCodeId: code.id, userId: input.userId } },
      select: { id: true },
    })
    if (alreadyUsed) return { ok: false, reason: 'ALREADY_USED' }

    const { discountCents, netCents } = applyDiscount(input.baseCents, code)
    return { ok: true, code, discountCents, netCents }
  }

  /**
   * Consumes one redemption.
   *
   * The cap is applied with a conditional update rather than a read followed by
   * a write: two students redeeming the last use of a code at the same moment
   * would both pass a read check, and only the conditional update lets exactly
   * one of them through. The unique index on (code, user) does the same job for
   * the one-per-person rule, so a duplicate raises instead of double-counting.
   */
  static async redeem(input: {
    codeId: string
    userId: string
    courseId: string
    amountOffCents: number
    client?: PrismaClientLike
  }) {
    const client = input.client ?? db

    // Raw SQL because the cap compares two columns of the same row
    // (redemptions < maxRedemptions), which Prisma's updateMany cannot express.
    // The whole check-and-increment is one statement, so the row lock decides
    // the race instead of the application.
    const claimed = await client.$executeRaw`
      UPDATE "DiscountCode"
      SET "redemptions" = "redemptions" + 1, "updatedAt" = NOW()
      WHERE "id" = ${input.codeId}
        AND "isActive" = true
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
        AND ("maxRedemptions" IS NULL OR "redemptions" < "maxRedemptions")
    `

    if (claimed === 0) {
      throw new DiscountUnavailableError('EXHAUSTED')
    }

    return client.discountRedemption.create({
      data: {
        discountCodeId: input.codeId,
        userId: input.userId,
        courseId: input.courseId,
        amountOffCents: input.amountOffCents,
      },
    })
  }

  /** Re-prices a code that was already validated, for display only. */
  static preview(baseCents: number, code: Pick<DiscountCode, 'type' | 'value'>) {
    return calculateDiscountCents(baseCents, code)
  }
}

export class DiscountUnavailableError extends Error {
  constructor(readonly reason: DiscountRejectionReason) {
    super(reason)
    this.name = 'DiscountUnavailableError'
  }
}
