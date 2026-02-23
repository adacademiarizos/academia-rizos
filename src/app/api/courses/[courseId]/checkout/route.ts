/**
 * POST /api/courses/[courseId]/checkout
 * Create Stripe checkout session for course purchase
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { CourseService } from '@/server/services/course-service'
import { addStripeFees } from '@/lib/fees'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params

    // Validate courseId
    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      )
    }

    // Check authentication
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    // Get user from database
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, name: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Fetch course and Stripe fee settings in parallel
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
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      )
    }

    if (!course.isActive) {
      return NextResponse.json(
        { success: false, error: 'Course is not available' },
        { status: 400 }
      )
    }

    // Check if user already has lifetime access
    const existingAccess = await db.courseAccess.findUnique({
      where: {
        userId_courseId: { userId: user.id, courseId },
      },
    })

    if (existingAccess && !existingAccess.accessUntil) {
      return NextResponse.json(
        { success: false, error: 'You already have access to this course' },
        { status: 400 }
      )
    }

    // Calculate total charge (base + Stripe passthrough fee)
    const feePercent = settings?.feePercent ?? 2.5
    const feeFixedCents = settings?.feeFixedCents ?? 25
    const { totalCents, feeCents } = addStripeFees({
      baseCents: course.priceCents,
      feePercent,
      feeFixedCents,
    })

    // Create Stripe checkout session
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
      metadata: {
        type: 'COURSE',
        courseId: course.id,
        userId: user.id,
        priceCents: String(course.priceCents),
        feeCents: String(feeCents),
        totalCents: String(totalCents),
        rentalDays: course.rentalDays ? String(course.rentalDays) : 'lifetime',
      },
    })

    // Create Payment record
    if (!checkoutSession.url) {
      throw new Error('Failed to generate Stripe checkout URL')
    }

    await db.payment.create({
      data: {
        type: 'COURSE',
        status: 'PROCESSING',
        amountCents: totalCents,
        currency: course.currency,
        stripeCheckoutSessionId: checkoutSession.id,
        courseId: course.id,
        payerId: user.id,
        payerEmail: user.email,
        metadata: {
          type: 'COURSE',
          courseId: course.id,
          userId: user.id,
          basePriceCents: course.priceCents,
          feeCents,
          totalCents,
        },
      },
    })

    console.log(`✅ Checkout session created for course: ${course.title}`)

    return NextResponse.json({
      success: true,
      data: {
        checkoutUrl: checkoutSession.url,
      },
    })
  } catch (error) {
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
