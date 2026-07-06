import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { getNextLessonOrder } from '@/lib/academy-content'

const CreateLessonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  videoFileUrl: z.string().optional().nullable(),
  transcript: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    const { styleId } = await params

    const style = await db.moduleStyle.findUnique({
      where: { id: styleId },
      select: { id: true },
    })

    if (!style) {
      return NextResponse.json({ success: false, error: 'Style not found' }, { status: 404 })
    }

    const lessons = await db.lesson.findMany({
      where: { styleId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ success: true, data: lessons })
  } catch (error) {
    console.error('Error fetching style lessons:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch lessons' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    const { styleId } = await params

    const style = await db.moduleStyle.findUnique({
      where: { id: styleId },
      select: { id: true, moduleId: true },
    })

    if (!style) {
      return NextResponse.json({ success: false, error: 'Style not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = CreateLessonSchema.parse(body)
    const order = data.order ?? (await getNextLessonOrder(styleId))

    const lesson = await db.lesson.create({
      data: {
        styleId,
        moduleId: style.moduleId,
        order,
        title: data.title,
        description: data.description ?? null,
        videoUrl: data.videoUrl || null,
        videoFileUrl: data.videoFileUrl || null,
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

    console.error('Error creating style lesson:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create lesson' },
      { status: 500 }
    )
  }
}
