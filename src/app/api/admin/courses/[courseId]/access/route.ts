/**
 * GET    /api/admin/courses/[courseId]/access — who has access, and how they got it.
 * POST   /api/admin/courses/[courseId]/access — grant access by hand (a scholarship).
 * DELETE /api/admin/courses/[courseId]/access — revoke it.
 *
 * Until this existed, CourseAccess could only ever be created by the Stripe
 * webhook, so a scholarship, a bank transfer or a failed payment all had to be
 * fixed by writing to the database directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { NotificationEventService } from '@/server/services/notification-event-service'

const GrantSchema = z.object({
  // Either identifies the student; email is what an admin actually has to hand.
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  /** null or absent = lifetime, matching CourseAccess.accessUntil. */
  days: z.number().int().positive().max(3650).nullable().optional(),
  note: z.string().trim().max(500).optional(),
}).refine((value) => value.userId || value.email, {
  message: 'Indica el usuario por id o por email',
})

const RevokeSchema = z.object({
  userId: z.string().min(1),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  const { courseId } = await params

  const access = await db.courseAccess.findMany({
    where: { courseId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      accessUntil: true,
      revokedAt: true,
      createdAt: true,
      source: true,
      grantNote: true,
      user: { select: { id: true, name: true, email: true, image: true } },
      grantedBy: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ success: true, data: access })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  const { courseId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
  }

  const validation = GrantSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { userId, email, days, note } = validation.data

  const [course, student] = await Promise.all([
    db.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
    db.user.findUnique({
      where: userId ? { id: userId } : { email: email!.toLowerCase().trim() },
      select: { id: true, name: true, email: true, deletedAt: true },
    }),
  ])

  if (!course) {
    return NextResponse.json({ success: false, error: 'Curso no encontrado' }, { status: 404 })
  }

  if (!student || student.deletedAt) {
    return NextResponse.json(
      { success: false, error: 'No existe una cuenta con ese email' },
      { status: 404 }
    )
  }

  const accessUntil = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null

  // A grant also lifts an earlier revocation: an admin handing out access is
  // the most explicit signal there is that the student should be let back in.
  const access = await db.courseAccess.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    create: {
      userId: student.id,
      courseId: course.id,
      accessUntil,
      source: 'GRANT',
      grantedById: auth.user.id,
      grantNote: note || null,
    },
    update: {
      accessUntil,
      revokedAt: null,
      source: 'GRANT',
      grantedById: auth.user.id,
      grantNote: note || null,
    },
    select: { id: true, accessUntil: true, createdAt: true, source: true },
  })

  // The grant stands whether or not the student can be notified about it.
  NotificationEventService.courseAccessGranted({
    accessId: access.id,
    userId: student.id,
    courseId: course.id,
    courseTitle: course.title,
    accessUntil: access.accessUntil,
  }).catch((error: unknown) =>
    console.error('[notif] course access granted notification error', error)
  )

  return NextResponse.json({
    success: true,
    data: { ...access, user: { id: student.id, name: student.name, email: student.email } },
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  const { courseId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
  }

  const validation = RevokeSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
  }

  const [course, existing] = await Promise.all([
    db.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
    db.courseAccess.findUnique({
      where: { userId_courseId: { userId: validation.data.userId, courseId } },
      select: { id: true, revokedAt: true },
    }),
  ])

  if (!course || !existing) {
    return NextResponse.json({ success: false, error: 'Acceso no encontrado' }, { status: 404 })
  }

  // Idempotent: re-revoking keeps the original timestamp rather than pushing it
  // forward, matching CourseService.revokeCourseAccess.
  if (existing.revokedAt) {
    return NextResponse.json({ success: true, data: { id: existing.id, revokedAt: existing.revokedAt } })
  }

  const revoked = await db.courseAccess.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
    select: { id: true, revokedAt: true },
  })

  NotificationEventService.courseAccessRevoked({
    accessId: revoked.id,
    userId: validation.data.userId,
    courseId: course.id,
    courseTitle: course.title,
  }).catch((error: unknown) =>
    console.error('[notif] course access revoked notification error', error)
  )

  return NextResponse.json({ success: true, data: revoked })
}
