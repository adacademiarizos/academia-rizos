import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'

const CreateModuleSchema = z.object({
  order: z.number().int().min(0).optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  videoFileUrl: z.string().url().optional().or(z.literal('')),
})

async function getCourseForModules(courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, contentStructure: true } })
  if (!course) return { error: 'Course not found' as const }
  if (course.contentStructure === 'STYLES') return { error: 'Este curso está organizado solo por estilos' as const }
  if (!course.contentStructure) return { error: 'El curso necesita definir su estructura primero' as const }
  return { course }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response
  const { courseId } = await params
  const result = await getCourseForModules(courseId)
  if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: result.error === 'Course not found' ? 404 : 409 })
  const modules = await db.module.findMany({ where: { courseId, styleId: null }, orderBy: { order: 'asc' }, include: { lessons: { where: { styleId: null }, orderBy: { order: 'asc' } } } })
  return NextResponse.json({ success: true, data: modules })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response
  try {
    const { courseId } = await params
    const result = await getCourseForModules(courseId)
    if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: result.error === 'Course not found' ? 404 : 409 })
    const data = CreateModuleSchema.parse(await request.json())
    const last = await db.module.findFirst({ where: { courseId, styleId: null }, orderBy: { order: 'desc' }, select: { order: true } })
    const module = await db.module.create({ data: { courseId, styleId: null, order: data.order ?? (last?.order ?? -1) + 1, title: data.title, description: data.description || null, videoFileUrl: data.videoFileUrl || null } })
    return NextResponse.json({ success: true, data: module }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Validation error', details: error.issues }, { status: 400 })
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create module' }, { status: 500 })
  }
}
