import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { lessonAuthoringSelect } from '@/lib/academy-content-selects'
import { db } from '@/lib/db'
import { getNextStyleLessonOrder } from '@/lib/academy-content'

const CreateLessonSchema = z.object({ title: z.string().min(1), description: z.string().optional().nullable(), videoFileUrl: z.string().url().optional().nullable(), order: z.number().int().min(0).optional() })

export async function GET(_request: NextRequest, { params }: { params: Promise<{ styleId: string }> }) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response
  const { styleId } = await params
  const style = await db.moduleStyle.findUnique({ where: { id: styleId }, select: { id: true } })
  if (!style) return NextResponse.json({ success: false, error: 'Style not found' }, { status: 404 })
  const lessons = await db.lesson.findMany({
    where: { styleId, moduleId: null },
    orderBy: { order: 'asc' },
    select: lessonAuthoringSelect,
  })
  return NextResponse.json({ success: true, data: lessons })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ styleId: string }> }) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response
  try {
    const { styleId } = await params
    const style = await db.moduleStyle.findUnique({ where: { id: styleId }, select: { id: true, courseId: true } })
    if (!style) return NextResponse.json({ success: false, error: 'Style not found' }, { status: 404 })
    const data = CreateLessonSchema.parse(await request.json())
    const lesson = await db.lesson.create({
      data: { courseId: style.courseId, styleId, moduleId: null, order: data.order ?? await getNextStyleLessonOrder(styleId), title: data.title, description: data.description ?? null, videoFileUrl: data.videoFileUrl ?? null },
      select: lessonAuthoringSelect,
    })
    return NextResponse.json({ success: true, data: lesson }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Validation error', details: error.issues }, { status: 400 })
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create lesson' }, { status: 500 })
  }
}
