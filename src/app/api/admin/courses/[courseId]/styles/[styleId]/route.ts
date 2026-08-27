import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { slugifyStyleName } from '@/lib/academy-content'

const UpdateStyleSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().optional().nullable(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

async function getUniqueStyleSlug(courseId: string, name: string, styleId: string) {
  const baseSlug = slugifyStyleName(name)
  let slug = baseSlug
  let suffix = 2
  while (true) {
    const existing = await db.moduleStyle.findUnique({ where: { courseId_slug: { courseId, slug } }, select: { id: true } })
    if (!existing || existing.id === styleId) return slug
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

async function findCourseStyle(courseId: string, styleId: string) {
  return db.moduleStyle.findFirst({ where: { id: styleId, courseId }, select: { id: true, name: true } })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ courseId: string; styleId: string }> }) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response
    const { courseId, styleId } = await params
    if (!await findCourseStyle(courseId, styleId)) return NextResponse.json({ success: false, error: 'Estilo no encontrado.' }, { status: 404 })
    const input = UpdateStyleSchema.parse(await request.json())
    const style = await db.moduleStyle.update({
      where: { id: styleId },
      data: {
        ...(input.name !== undefined && { name: input.name, slug: await getUniqueStyleSlug(courseId, input.name, styleId) }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.order !== undefined && { order: input.order }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    })
    return NextResponse.json({ success: true, data: style })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Datos de estilo inválidos.', details: error.issues }, { status: 400 })
    console.error('Error updating course style:', error)
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el estilo.' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ courseId: string; styleId: string }> }) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response
    const { courseId, styleId } = await params
    const style = await findCourseStyle(courseId, styleId)
    if (!style) return NextResponse.json({ success: false, error: 'Estilo no encontrado.' }, { status: 404 })
    await db.moduleStyle.delete({ where: { id: styleId } })
    return NextResponse.json({ success: true, data: { id: style.id } })
  } catch (error) {
    console.error('Error deleting course style:', error)
    return NextResponse.json({ success: false, error: 'No se pudo eliminar el estilo.' }, { status: 500 })
  }
}
