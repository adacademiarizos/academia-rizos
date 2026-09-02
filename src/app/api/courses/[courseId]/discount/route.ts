/**
 * POST /api/courses/[courseId]/discount
 * Prices a discount code against this course for the signed-in student without
 * consuming it, so the course page can show the new total before anyone commits.
 * Checkout re-validates and only then redeems: nothing here is binding.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { addStripeFees } from '@/lib/fees'
import { DISCOUNT_REJECTION_MESSAGES } from '@/lib/discount'
import { DiscountService } from '@/server/services/discount-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Inicia sesión para usar un código' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const rawCode = typeof body.code === 'string' ? body.code.trim() : ''
    if (!rawCode) {
      return NextResponse.json({ success: false, error: 'Escribe un código' }, { status: 400 })
    }

    const [user, course, settings] = await Promise.all([
      db.user.findUnique({
        where: { email: session.user.email.toLowerCase() },
        select: { id: true },
      }),
      db.course.findUnique({
        where: { id: courseId },
        select: { id: true, priceCents: true, currency: true, isActive: true },
      }),
      db.settings.findUnique({ where: { id: 'global' } }),
    ])

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (!course || !course.isActive) {
      return NextResponse.json({ success: false, error: 'Curso no disponible' }, { status: 404 })
    }

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

    const feePercent = settings?.feePercent ?? 2.5
    const feeFixedCents = settings?.feeFixedCents ?? 25
    const { totalCents } = validation.netCents > 0
      ? addStripeFees({ baseCents: validation.netCents, feePercent, feeFixedCents })
      : { totalCents: 0 }

    return NextResponse.json({
      success: true,
      data: {
        code: validation.code.code,
        type: validation.code.type,
        value: validation.code.value,
        discountCents: validation.discountCents,
        netCents: validation.netCents,
        totalCents,
        currency: course.currency,
        /** true when the code covers the course completely. */
        coversFullPrice: validation.netCents <= 0,
      },
    })
  } catch (error) {
    console.error('Error validating discount code:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo validar el código' },
      { status: 500 }
    )
  }
}
