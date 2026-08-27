import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'

const UpdateLessonSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  videoFileUrl: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ styleId: string; lessonId: string }> }
) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    const { styleId, lessonId } = await params

    const lesson = await db.lesson.findFirst({
      where: { id: lessonId, styleId },
      select: { id: true },
    })

    if (!lesson) {
      return NextResponse.json({ success: false, error: 'Lesson not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = UpdateLessonSchema.parse(body)

    const updated = await db.lesson.update({
      where: { id: lessonId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.videoFileUrl !== undefined && { videoFileUrl: data.videoFileUrl }),
        ...(data.order !== undefined && { order: data.order }),
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

    console.error('Error updating style lesson:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update lesson' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ styleId: string; lessonId: string }> }
) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    const { styleId, lessonId } = await params

    const lesson = await db.lesson.findFirst({
      where: { id: lessonId, styleId },
      select: { id: true },
    })

    if (!lesson) {
      return NextResponse.json({ success: false, error: 'Lesson not found' }, { status: 404 })
    }

    await db.lesson.delete({ where: { id: lessonId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting style lesson:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete lesson' },
      { status: 500 }
    )
  }
}
