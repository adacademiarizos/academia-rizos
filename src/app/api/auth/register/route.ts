/**
 * POST /api/auth/register
 * Register a new user with email and password
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { z } from 'zod'
import { NotificationEventService } from '@/server/services/notification-event-service'
import { sendAdminAlertEmail } from '@/lib/mail'
import { NotificationService } from '@/server/services/notification-service'
import { hasCompletedDeletionForEmail } from '@/server/services/gdpr-service'

const RegisterSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = RegisterSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error.issues[0]?.message || 'Datos inválidos',
        },
        { status: 400 }
      )
    }

    const { name, email: rawEmail, password } = validation.data
    const email = rawEmail.toLowerCase().trim()

    if (await hasCompletedDeletionForEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'No se puede reutilizar este email para una nueva cuenta' },
        { status: 403 }
      )
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'Este email ya está registrado',
        },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await db.user.create({
      data: {
        name: name.trim(),
        email,
        password: hashedPassword,
        role: 'STUDENT',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    // Track registration conversion
    await db.conversionEvent.create({
      data: {
        type: 'REGISTRATION',
        sessionId: body.analyticsSessionId || 'unknown',
        userId: user.id,
        utmSource: body.utmSource || null,
        utmMedium: body.utmMedium || null,
        utmCampaign: body.utmCampaign || null,
        referrer: body.referrer || null,
      },
    }).catch((e) => console.error('[analytics] registration conversion error:', e))

    // Registration is an optional, low-priority in-app operational signal.
    // Its delivery must never make a successfully-created account fail.
    await NotificationEventService.userRegistered(user.id, 'contraseña')

    const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } }).catch(() => [])
    const adminEmails = admins.map((admin: { email: string }) => admin.email)
    if (adminEmails.length > 0) {
      sendAdminAlertEmail({
        to: adminEmails,
        subject: `Nuevo registro - ${user.name}`,
        title: 'Nuevo usuario registrado',
        rows: [['Nombre', user.name ?? '-'], ['Email', user.email], ['Fecha', new Date().toLocaleDateString('es-ES', { dateStyle: 'long' })]],
      }).catch((error: unknown) => console.error('[mail] admin new-user notification error', error))
    }
    NotificationService.notifyAllAdmins({
      type: 'NEW_USER', title: 'Nuevo usuario registrado',
      message: `${user.name ?? user.email} se ha registrado en la plataforma`, relatedId: user.id,
    }).catch((error: unknown) => console.error('[notif] admin new-user notification error', error))

    return NextResponse.json(
      {
        success: true,
        message: 'Cuenta registrada exitosamente',
        data: user,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validación fallida',
          details: error.issues,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Error al registrar usuario',
      },
      { status: 500 }
    )
  }
}
