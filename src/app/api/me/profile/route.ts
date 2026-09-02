/**
 * GET  /api/me/profile — the caller's own editable profile.
 * PATCH /api/me/profile — update it and mark the profile as confirmed.
 *
 * The name stored here is the one printed on certificates
 * (server/services/certificate.service.ts), so confirming it is what the
 * onboarding step exists for. The caller is always resolved from the session,
 * never from the request body.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'

const ProfileSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
  // Optional by design: the student is asked for them, never blocked by them.
  phone: z.string().trim().max(40).optional().nullable(),
  image: z.string().url('La imagen no es válida').max(2048).optional().nullable(),
})

async function requireUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return db.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phone: true,
      profileCompletedAt: true,
      deletedAt: true,
    },
  })
}

export async function GET() {
  const user = await requireUser()
  if (!user || user.deletedAt) {
    return NextResponse.json({ success: false, error: 'Debes iniciar sesión' }, { status: 401 })
  }

  const { deletedAt, ...profile } = user
  void deletedAt
  return NextResponse.json({ success: true, data: profile })
}

export async function PATCH(request: NextRequest) {
  const user = await requireUser()
  if (!user || user.deletedAt) {
    return NextResponse.json({ success: false, error: 'Debes iniciar sesión' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
  }

  const validation = ProfileSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { name, phone, image } = validation.data

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      name,
      phone: phone?.trim() ? phone.trim() : null,
      // An absent image leaves the current one alone; an explicit null clears it.
      ...(image === undefined ? {} : { image }),
      profileCompletedAt: user.profileCompletedAt ?? new Date(),
    },
    select: { id: true, name: true, email: true, image: true, phone: true, profileCompletedAt: true },
  })

  return NextResponse.json({ success: true, data: updated })
}
