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

export async function getNextStyleOrder(courseId: string) {
  const lastStyle = await db.moduleStyle.findFirst({
    where: { courseId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  return (lastStyle?.order ?? -1) + 1
}

export async function getNextLessonOrder(moduleId: string) {
  const lastLesson = await db.lesson.findFirst({
    where: { moduleId, styleId: null },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  return (lastLesson?.order ?? -1) + 1
}

export async function getNextStyleLessonOrder(styleId: string) {
  const lastLesson = await db.lesson.findFirst({
    where: { styleId, moduleId: null },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  return (lastLesson?.order ?? -1) + 1
}
