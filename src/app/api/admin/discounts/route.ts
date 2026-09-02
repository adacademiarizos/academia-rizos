/**
 * GET  /api/admin/discounts — list every code with its usage.
 * POST /api/admin/discounts — create one.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { normalizeDiscountCode } from '@/lib/discount'

const CreateSchema = z
  .object({
    code: z.string().trim().min(3, 'El código necesita al menos 3 caracteres').max(40),
    description: z.string().trim().max(200).optional(),
    type: z.enum(['PERCENT', 'FIXED']),
    /** Percentage points for PERCENT, cents for FIXED. */
    value: z.number().int().positive(),
    /** null = every course. */
    courseId: z.string().nullable().optional(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .refine((input) => input.type !== 'PERCENT' || input.value <= 100, {
    message: 'Un descuento por porcentaje no puede superar 100',
    path: ['value'],
  })

export async function GET() {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  const codes = await db.discountCode.findMany({
    orderBy: { createdAt: 'desc' },
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
      createdAt: true,
      course: { select: { id: true, title: true } },
      createdBy: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json({ success: true, data: codes })
}

export async function POST(request: NextRequest) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
  }

  const validation = CreateSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { code, description, type, value, courseId, maxRedemptions, expiresAt } = validation.data
  const normalized = normalizeDiscountCode(code)

  const clash = await db.discountCode.findUnique({
    where: { code: normalized },
    select: { id: true },
  })

  if (clash) {
    return NextResponse.json(
      { success: false, error: `El código ${normalized} ya existe` },
      { status: 409 }
    )
  }

  const created = await db.discountCode.create({
    data: {
      code: normalized,
      description: description || null,
      type,
      value,
      courseId: courseId || null,
      maxRedemptions: maxRedemptions ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdById: auth.user.id,
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
      createdAt: true,
      course: { select: { id: true, title: true } },
    },
  })

  return NextResponse.json({ success: true, data: created }, { status: 201 })
}
