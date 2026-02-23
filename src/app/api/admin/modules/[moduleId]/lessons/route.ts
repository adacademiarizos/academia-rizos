/**
 * GET /api/admin/modules/[moduleId]/lessons - List all lessons for a module
 * POST /api/admin/modules/[moduleId]/lessons - Create a new lesson
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const CreateLessonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
})

async function verifyAdmin() {
  const session = await getServerSession()
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

    const module = await db.module.findUnique({ where: { id: moduleId } })
    if (!module) {
      return NextResponse.json(
        { success: false, error: 'Module not found' },
        { status: 404 }
      )
    }

    const lessons = await db.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ success: true, data: lessons })
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

    const module = await db.module.findUnique({ where: { id: moduleId } })
    if (!module) {
      return NextResponse.json(
        { success: false, error: 'Module not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = CreateLessonSchema.parse(body)

    // Get next order number
    const lastLesson = await db.lesson.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' },
    })
    const nextOrder = (lastLesson?.order ?? -1) + 1

    const lesson = await db.lesson.create({
      data: {
        moduleId,
        order: nextOrder,
        title: data.title,
        description: data.description ?? null,
        videoUrl: data.videoUrl ?? null,
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
