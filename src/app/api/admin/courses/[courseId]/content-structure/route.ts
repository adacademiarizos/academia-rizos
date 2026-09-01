import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { slugifyStyleName } from '@/lib/academy-content'

const StructureSchema = z.object({ contentStructure: z.enum(['MODULES', 'STYLES', 'BOTH']) })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const { courseId } = await params
    const { contentStructure } = StructureSchema.parse(await request.json())
    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: { lessons: { orderBy: { order: 'asc' } } },
        },
        styles: { orderBy: { order: 'asc' } },
      },
    })
    if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 })
    if (course.contentStructure) {
      return NextResponse.json({ success: false, error: 'La estructura ya está definida para este curso' }, { status: 409 })
    }

    await db.$transaction(async (tx) => {
      if (contentStructure === 'MODULES' || contentStructure === 'BOTH') {
        await tx.module.updateMany({ where: { courseId }, data: { styleId: null } })
        await tx.lesson.updateMany({ where: { courseId, moduleId: { not: null } }, data: { styleId: null } })
      } else {
        const stylesById = new Map(course.styles.map((style) => [style.id, style]))
        let generalStyle = course.styles.find((style) => slugifyStyleName(style.name) === 'general')
        const nextOrders = new Map<string, number>()
        const directLessons = await tx.lesson.findMany({
          where: { courseId, styleId: { not: null }, moduleId: null },
          select: { styleId: true, order: true },
        })
        for (const lesson of directLessons) {
          if (lesson.styleId) nextOrders.set(lesson.styleId, Math.max(nextOrders.get(lesson.styleId) ?? -1, lesson.order))
        }

        for (const module of course.modules) {
          let targetStyle = module.styleId ? stylesById.get(module.styleId) : undefined
          if (!targetStyle) {
            if (!generalStyle) {
              generalStyle = await tx.moduleStyle.create({
                data: {
                  courseId,
                  order: course.styles.length,
                  name: 'General',
                  slug: 'general',
                  description: 'Lecciones migradas desde la estructura anterior.',
                  isActive: true,
                },
              })
            }
            targetStyle = generalStyle
          }

          const nextOrder = () => (nextOrders.get(targetStyle.id) ?? -1) + 1
          if (module.videoFileUrl) {
            const order = nextOrder()
            nextOrders.set(targetStyle.id, order)
            await tx.lesson.create({
              data: {
                courseId,
                styleId: targetStyle.id,
                moduleId: null,
                order,
                title: module.title,
                description: module.description,
                videoFileUrl: module.videoFileUrl,
              },
            })
          }
          for (const lesson of module.lessons) {
            const order = nextOrder()
            nextOrders.set(targetStyle.id, order)
            await tx.lesson.update({ where: { id: lesson.id }, data: { moduleId: null, styleId: targetStyle.id, order } })
          }
        }
      }

      await tx.course.update({ where: { id: courseId }, data: { contentStructure } })
      await tx.courseDraft.deleteMany({ where: { courseId } })
    })

    return NextResponse.json({ success: true, data: { contentStructure } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'La estructura seleccionada no es válida' }, { status: 400 })
    }
    console.error('Error migrating course content structure:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'No se pudo migrar el curso' }, { status: 500 })
  }
}
