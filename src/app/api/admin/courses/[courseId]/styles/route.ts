import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { getNextStyleOrder, slugifyStyleName } from '@/lib/academy-content'

const CreateStyleSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  description: z.string().trim().optional().nullable(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

async function getUniqueStyleSlug(courseId: string, name: string) {
  const baseSlug = slugifyStyleName(name)
  let slug = baseSlug
  let suffix = 2

  while (await db.moduleStyle.findUnique({ where: { courseId_slug: { courseId, slug } }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return slug
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    const { courseId } = await params
    const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } })
    if (!course) return NextResponse.json({ success: false, error: 'Curso no encontrado.' }, { status: 404 })

    const styles = await db.moduleStyle.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: { lessons: { orderBy: { order: 'asc' } } },
    })
    return NextResponse.json({ success: true, data: styles })
  } catch (error) {
    console.error('Error fetching course styles:', error)
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los estilos.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    const { courseId } = await params
    const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } })
    if (!course) return NextResponse.json({ success: false, error: 'Curso no encontrado.' }, { status: 404 })

    const input = CreateStyleSchema.parse(await request.json())
    const style = await db.moduleStyle.create({
      data: {
        courseId,
        name: input.name,
        slug: await getUniqueStyleSlug(courseId, input.name),
        description: input.description || null,
        order: input.order ?? await getNextStyleOrder(courseId),
        isActive: input.isActive ?? true,
      },
    })
    return NextResponse.json({ success: true, data: style }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Datos de estilo inválidos.', details: error.issues }, { status: 400 })
    console.error('Error creating course style:', error)
    return NextResponse.json({ success: false, error: 'No se pudo crear el estilo.' }, { status: 500 })
  }
}
