/**
 * POST /api/courses/[courseId]/checkout
 *
 * Starts a course purchase. Three outcomes are possible:
 *  - the course is free, or a discount code covers it in full, so access is
 *    granted here and no Stripe session exists at all;
 *  - there is something to charge, so a Stripe checkout session is returned;
 *  - the request is rejected (no access, bad code, unchargeable amount).
 *
 * A zero total can never go to Stripe: its minimum charge is 50 cents, so a
 * free enrolment has to be handled entirely on our side.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { isCourseAccessActive } from '@/lib/course-access'
import { stripe } from '@/lib/stripe'
import { addStripeFees } from '@/lib/fees'
import {
  DISCOUNT_REJECTION_MESSAGES,
  isChargeable,
  normalizeDiscountCode,
  STRIPE_MINIMUM_CHARGE_CENTS,
} from '@/lib/discount'
import { DiscountService, DiscountUnavailableError } from '@/server/services/discount-service'
import { CourseService } from '@/server/services/course-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const [course, settings] = await Promise.all([
      db.course.findUnique({
        where: { id: courseId },
        select: {
          id: true,
          title: true,
          description: true,
          priceCents: true,
          currency: true,
          rentalDays: true,
          isActive: true,
        },
      }),
      db.settings.findUnique({ where: { id: 'global' } }),
    ])

    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 })
    }

    if (!course.isActive) {
      return NextResponse.json(
        { success: false, error: 'Course is not available' },
        { status: 400 }
      )
    }

    const existingAccess = await db.courseAccess.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { accessUntil: true, revokedAt: true },
    })

    if (existingAccess && isCourseAccessActive(existingAccess) && !existingAccess.accessUntil) {
      return NextResponse.json(
        { success: false, error: 'You already have access to this course' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const rawCode = typeof body.discountCode === 'string' ? body.discountCode.trim() : ''

    // Price the code before anything is charged or granted. Validation is
    // read-only; the redemption below is what actually consumes a use.
    let discountCents = 0
    let discountCodeId: string | null = null

    if (rawCode) {
      const validation = await DiscountService.validate({
        code: rawCode,
        courseId: course.id,
        userId: user.id,
        baseCents: course.priceCents,
      })

      if (!validation.ok) {
        return NextResponse.json(
          { success: false, error: DISCOUNT_REJECTION_MESSAGES[validation.reason], code: validation.reason },
          { status: 400 }
        )
      }

      discountCents = validation.discountCents
      discountCodeId = validation.code.id
    }

    const netCents = course.priceCents - discountCents

    const feePercent = settings?.feePercent ?? 2.5
    const feeFixedCents = settings?.feeFixedCents ?? 25
    // Fees are recalculated on the discounted amount: charging the fee for a
    // price the student is not paying would quietly erase part of the discount.
    const { totalCents, feeCents } = netCents > 0
      ? addStripeFees({ baseCents: netCents, feePercent, feeFixedCents })
      : { totalCents: 0, feeCents: 0 }

    const analytics = {
      analyticsSessionId: body.analyticsSessionId || '',
      utmSource: body.utmSource || '',
      utmMedium: body.utmMedium || '',
      utmCampaign: body.utmCampaign || '',
      analyticsReferrer: body.referrer || '',
    }

    // --- Free enrolment -----------------------------------------------------
    // Either the course costs nothing or the code covered all of it. Stripe is
    // not involved, so access is granted right here, inside one transaction
    // with the redemption so a code can never be consumed without the access it
    // paid for.
    if (netCents <= 0) {
      await db.$transaction(async (transaction) => {
        if (discountCodeId) {
          await DiscountService.redeem({
            codeId: discountCodeId,
            userId: user.id,
            courseId: course.id,
            amountOffCents: discountCents,
            client: transaction,
          })
        }

        await CourseService.createCourseAccess(user.id, course.id, transaction)
        await transaction.courseAccess.update({
          where: { userId_courseId: { userId: user.id, courseId: course.id } },
          data: {
            source: discountCodeId ? 'PURCHASE' : 'FREE',
            grantNote: discountCodeId ? `Código ${normalizeDiscountCode(rawCode)} (100%)` : null,
          },
        })
      })

      return NextResponse.json({
        success: true,
        data: { enrolled: true, checkoutUrl: null, totalCents: 0 },
      })
    }

    // --- Paid checkout ------------------------------------------------------
    // Below Stripe's minimum there is no way to take the money at all. Failing
    // loudly here beats a Stripe error the student cannot act on.
    if (!isChargeable(totalCents)) {
      return NextResponse.json(
        {
          success: false,
          error: `El importe a cobrar (${(totalCents / 100).toFixed(2)} ${course.currency}) es menor al mínimo de ${(STRIPE_MINIMUM_CHARGE_CENTS / 100).toFixed(2)} que acepta la pasarela de pago.`,
        },
        { status: 400 }
      )
    }

    const metadata = {
      type: 'COURSE',
      courseId: course.id,
      userId: user.id,
      priceCents: String(course.priceCents),
      discountCents: String(discountCents),
      discountCodeId: discountCodeId ?? '',
      netCents: String(netCents),
      feeCents: String(feeCents),
      totalCents: String(totalCents),
      rentalDays: course.rentalDays ? String(course.rentalDays) : 'lifetime',
      ...analytics,
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      success_url: `${process.env.NEXTAUTH_URL}/courses/${courseId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/courses/${courseId}?canceled=1`,
      line_items: [
        {
          price_data: {
            currency: course.currency.toLowerCase(),
            product_data: {
              name: course.title,
              description: course.description || undefined,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: { metadata },
      metadata,
    })

    if (!checkoutSession.url) {
      throw new Error('Failed to generate Stripe checkout URL')
    }

    // The code is consumed when checkout starts, not when payment lands: two
    // people must not be able to hold the last use of a code at once. An
    // abandoned checkout therefore burns the student's own single use, which is
    // the same trade Stripe's own promotion codes make.
    if (discountCodeId) {
      await DiscountService.redeem({
        codeId: discountCodeId,
        userId: user.id,
        courseId: course.id,
        amountOffCents: discountCents,
      })
    }

    await db.payment.create({
      data: {
        type: 'COURSE',
        status: 'REQUIRES_PAYMENT',
        amountCents: totalCents,
        currency: course.currency,
        stripeCheckoutSessionId: checkoutSession.id,
        courseId: course.id,
        payerId: user.id,
        payerEmail: user.email,
        metadata,
      },
    })

    return NextResponse.json({
      success: true,
      data: { enrolled: false, checkoutUrl: checkoutSession.url, totalCents },
    })
  } catch (error) {
    if (error instanceof DiscountUnavailableError) {
      return NextResponse.json(
        { success: false, error: DISCOUNT_REJECTION_MESSAGES[error.reason], code: error.reason },
        { status: 409 }
      )
    }

    console.error('Error creating course checkout:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout',
      },
      { status: 500 }
    )
  }
}
