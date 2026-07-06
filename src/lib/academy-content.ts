import { db } from '@/lib/db'

export function slugifyStyleName(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return slug || 'estilo'
}

export async function ensureGeneralModuleStyle(moduleId: string) {
  const existing = await db.moduleStyle.findUnique({
    where: { moduleId_slug: { moduleId, slug: 'general' } },
  })

  if (existing) return existing

  const lastStyle = await db.moduleStyle.findFirst({
    where: { moduleId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  return db.moduleStyle.create({
    data: {
      moduleId,
      order: (lastStyle?.order ?? -1) + 1,
      name: 'General',
      slug: 'general',
      description: 'Contenido general de la seccion.',
      isActive: true,
    },
  })
}

export async function getNextStyleOrder(moduleId: string) {
  const lastStyle = await db.moduleStyle.findFirst({
    where: { moduleId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  return (lastStyle?.order ?? -1) + 1
}

export async function getNextLessonOrder(styleId: string) {
  const lastLesson = await db.lesson.findFirst({
    where: { styleId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  return (lastLesson?.order ?? -1) + 1
}
