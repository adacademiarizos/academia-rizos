/**
 * PATCH  /api/admin/discounts/[id] — activate, deactivate or retune a code.
 * DELETE /api/admin/discounts/[id] — remove one.
 *
 * A code that has already been redeemed is never deleted: its redemptions are
 * the record of what a student was charged, so it is deactivated instead.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'

const UpdateSchema = z
  .object({
    description: z.string().trim().max(200).nullable().optional(),
    value: z.number().int().positive().optional(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, { message: 'No hay cambios' })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
  }

  const validation = UpdateSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const existing = await db.discountCode.findUnique({
    where: { id },
    select: { id: true, type: true },
  })

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Código no encontrado' }, { status: 404 })
  }

  const { description, value, maxRedemptions, expiresAt, isActive } = validation.data

  if (value !== undefined && existing.type === 'PERCENT' && value > 100) {
    return NextResponse.json(
      { success: false, error: 'Un descuento por porcentaje no puede superar 100' },
      { status: 400 }
    )
  }

  const updated = await db.discountCode.update({
    where: { id },
    data: {
      ...(description === undefined ? {} : { description: description || null }),
      ...(value === undefined ? {} : { value }),
      ...(maxRedemptions === undefined ? {} : { maxRedemptions }),
      ...(expiresAt === undefined ? {} : { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      ...(isActive === undefined ? {} : { isActive }),
    },
    select: {
      id: true,
      code: true,
      description: true,
      type: true,
      value: true,
      maxRedemptions: true,
      redemptions: true,
      expiresAt: true,
      isActive: true,
      course: { select: { id: true, title: true } },
    },
  })

  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  const { id } = await params

  const existing = await db.discountCode.findUnique({
    where: { id },
    select: { id: true, redemptions: true },
  })

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Código no encontrado' }, { status: 404 })
  }

  // Deleting a used code would cascade its redemptions away, erasing the reason
  // a student paid what they paid. Deactivating keeps the history and has the
  // same practical effect: the code stops working.
  if (existing.redemptions > 0) {
    const deactivated = await db.discountCode.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true, redemptions: true },
    })

    return NextResponse.json({
      success: true,
      data: deactivated,
      message: 'El código ya fue usado, así que se desactivó en lugar de borrarse.',
    })
  }

  await db.discountCode.delete({ where: { id } })
  return NextResponse.json({ success: true, data: { id } })
}
