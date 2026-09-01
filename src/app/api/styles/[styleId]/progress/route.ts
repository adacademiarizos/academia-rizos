import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByStyleId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'
import { NotificationService } from '@/server/services/notification-service'

async function notifyWhenCourseComplete(userId: string, courseId: string) {
  const [modules, styles] = await Promise.all([
    db.module.findMany({ where: { courseId, styleId: null }, select: { id: true } }),
    db.moduleStyle.findMany({
      where: { courseId },
      select: { lessons: { where: { moduleId: null }, select: { id: true } } },
    }),
  ])
  const moduleProgress = await db.moduleProgress.count({
    where: { userId, completed: true, module: { courseId, styleId: null } },
  })
  const styleLessonIds = styles.flatMap((style) => style.lessons.map((lesson) => lesson.id))
  const completedStyleLessons = await db.lessonProgress.findMany({
    where: { userId, completed: true, lessonId: { in: styleLessonIds } },
    select: { lessonId: true },
  })
  const completedStyleLessonIds = new Set(completedStyleLessons.map((item) => item.lessonId))
  const stylesWithLessons = styles.filter((style) => style.lessons.length > 0)
  const stylesComplete = stylesWithLessons.every((style) =>
    style.lessons.every((lesson) => completedStyleLessonIds.has(lesson.id))
  )

  if (modules.length + stylesWithLessons.length === 0) return
  if (moduleProgress !== modules.length || !stylesComplete) return
  await NotificationService.triggerOnCourseCompletion(userId, courseId)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const { styleId } = await params
    const access = await authorizeCourseAccessByStyleId(styleId, { requireActiveAccess: true })
    if (!access.ok) return toAccessDeniedResponse(access)

    const { completed } = await request.json()
    if (typeof completed !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Completed must be a boolean' }, { status: 400 })
    }

    const lessons = await db.lesson.findMany({ where: { styleId, moduleId: null }, select: { id: true } })
    await db.$transaction(lessons.map((lesson) => db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: access.user.id, lessonId: lesson.id } },
      update: { completed, completedAt: completed ? new Date() : null },
      create: { userId: access.user.id, lessonId: lesson.id, completed, completedAt: completed ? new Date() : null },
    })))

    if (completed) {
      notifyWhenCourseComplete(access.user.id, access.courseId).catch((error) => {
        console.error('Course completion notification failed:', error)
      })
    }

    return NextResponse.json({ success: true, data: { completed, lessonCount: lessons.length } })
  } catch (error) {
    console.error('Error updating style progress:', error)
    return NextResponse.json({ success: false, error: 'Failed to update progress' }, { status: 500 })
  }
}
