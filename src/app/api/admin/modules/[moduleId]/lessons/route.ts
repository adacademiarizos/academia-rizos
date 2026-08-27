import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { getNextLessonOrder } from '@/lib/academy-content'

const CreateLessonSchema = z.object({ title: z.string().min(1), description: z.string().optional(), videoFileUrl: z.string().url().optional().or(z.literal('')) })

export async function GET(_request: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response
  const { moduleId } = await params
  const module = await db.module.findUnique({ where: { id: moduleId }, select: { id: true } })
  if (!module) return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 })
  const lessons = await db.lesson.findMany({ where: { moduleId, styleId: null }, orderBy: { order: 'asc' } })
  return NextResponse.json({ success: true, data: lessons })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response
  try {
    const { moduleId } = await params
    const module = await db.module.findUnique({ where: { id: moduleId }, select: { id: true, courseId: true, styleId: true } })
    if (!module || module.styleId) return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 })
    const data = CreateLessonSchema.parse(await request.json())
    const lesson = await db.lesson.create({ data: { courseId: module.courseId, moduleId, styleId: null, order: await getNextLessonOrder(moduleId), title: data.title, description: data.description || null, videoFileUrl: data.videoFileUrl || null } })
    return NextResponse.json({ success: true, data: lesson }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Validation error', details: error.issues }, { status: 400 })
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create lesson' }, { status: 500 })
  }
}
