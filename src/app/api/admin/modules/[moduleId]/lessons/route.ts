/**
 * GET /api/admin/modules/[moduleId]/lessons - List all lessons for a module
 * POST /api/admin/modules/[moduleId]/lessons - Create a new lesson
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { z } from 'zod'
import { ensureGeneralModuleStyle, getNextLessonOrder } from '@/lib/academy-content'

const CreateLessonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
  videoFileUrl: z.string().optional(),
  transcript: z.string().optional(),
})

async function verifyAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })

  return user?.role === 'ADMIN' ? user : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params

    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const courseModule = await db.module.findUnique({ where: { id: moduleId } })
    if (!courseModule) {
      return NextResponse.json(
        { success: false, error: 'Module not found' },
        { status: 404 }
      )
    }

    const lessons = await db.lesson.findMany({
      where: { moduleId },
      orderBy: [{ style: { order: 'asc' } }, { order: 'asc' }],
      include: {
        style: {
          select: { id: true, name: true, slug: true, order: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: lessons.map((lesson) => ({
        ...lesson,
        styleId: lesson.style.id,
        styleName: lesson.style.name,
      })),
    })
  } catch (error) {
    console.error('Error fetching lessons:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch lessons' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params

    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const courseModule = await db.module.findUnique({ where: { id: moduleId } })
    if (!courseModule) {
      return NextResponse.json(
        { success: false, error: 'Module not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = CreateLessonSchema.parse(body)

    const style = await ensureGeneralModuleStyle(moduleId)
    const nextOrder = await getNextLessonOrder(style.id)

    const lesson = await db.lesson.create({
      data: {
        moduleId,
        styleId: style.id,
        order: nextOrder,
        title: data.title,
        description: data.description ?? null,
        videoUrl: data.videoUrl ?? null,
        videoFileUrl: data.videoFileUrl ?? null,
        transcript: data.transcript ?? null,
      },
    })

    return NextResponse.json({ success: true, data: lesson }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error creating lesson:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create lesson' },
      { status: 500 }
    )
  }
}
