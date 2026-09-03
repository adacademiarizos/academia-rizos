/**
 * PATCH /api/me/password — change the caller's own password.
 *
 * Accounts created through an OAuth provider have no password to compare
 * against, so they set one here for the first time instead of rotating it. The
 * caller is always resolved from the session, never from the request body.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'

const PasswordSchema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(200),
})

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Debes iniciar sesión' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true, password: true, deletedAt: true },
  })

  if (!user || user.deletedAt) {
    return NextResponse.json({ success: false, error: 'Debes iniciar sesión' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
  }

  const validation = PasswordSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { currentPassword, newPassword } = validation.data

  // Only an account that already has a password has something to verify. Asking
  // an OAuth account for a current password it never had would lock it out of
  // ever setting one.
  if (user.password) {
    if (!currentPassword) {
      return NextResponse.json(
        { success: false, error: 'Escribe tu contraseña actual' },
        { status: 400 }
      )
    }

    const matches = await bcrypt.compare(currentPassword, user.password)
    if (!matches) {
      return NextResponse.json(
        { success: false, error: 'La contraseña actual no es correcta' },
        { status: 400 }
      )
    }
  }

  const hashed = await bcrypt.hash(newPassword, 10)
  await db.user.update({ where: { id: user.id }, data: { password: hashed } })

  return NextResponse.json({
    success: true,
    data: { hadPassword: Boolean(user.password) },
  })
}
