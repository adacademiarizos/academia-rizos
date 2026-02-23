/**
 * PUT /api/admin/modules/[moduleId]/lessons/[lessonId] - Update a lesson
 * DELETE /api/admin/modules/[moduleId]/lessons/[lessonId] - Delete a lesson
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const UpdateLessonSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  videoFileUrl: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
  transcript: z.string().optional().nullable(),
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; lessonId: string }> }
) {
  try {
    const { moduleId, lessonId } = await params

    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId, moduleId },
    })
    if (!lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = UpdateLessonSchema.parse(body)

    const updated = await db.lesson.update({
      where: { id: lessonId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
        ...(data.videoFileUrl !== undefined && { videoFileUrl: data.videoFileUrl }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.transcript !== undefined && { transcript: data.transcript }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error updating lesson:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update lesson' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; lessonId: string }> }
) {
  try {
    const { moduleId, lessonId } = await params

    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId, moduleId },
    })
    if (!lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    await db.lesson.delete({ where: { id: lessonId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lesson:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete lesson' },
      { status: 500 }
    )
  }
}
