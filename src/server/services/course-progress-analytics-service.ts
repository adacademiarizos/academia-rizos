/**
 * Per-course student-progress analytics (Phase 3 — WS2, design §D-05/D-11 AMENDED).
 *
 * Scope is progress-only: enrollments, per-module/per-lesson progress, completion
 * rate, and drop-off. No marketing metrics, no averageScore/attempts/passRate/
 * blockedStudents — all cut per D-05. All metrics are lifetime and unwindowed;
 * this service takes no date range.
 *
 * `MarketingAnalyticsService` is not touched by this file at all.
 */
import { db } from '@/lib/db'
import { buildActiveCourseAccessWhere } from '@/lib/course-access'

export type CourseProgressAnalytics = {
  enrolledStudents: number
  completedStudents: number
  completionRate: number // 0-100, 0 when enrolled === 0
  modules: { moduleId: string; title: string; order: number; completedStudents: number }[]
  lessons: {
    lessonId: string
    title: string
    sequenceIndex: number
    moduleTitle: string | null // null = course-level lesson (D-11)
    reachedStudents: number
    completedStudents: number
  }[]
  dropOff: {
    lessonId: string | null // null = the "no ha empezado" bucket
    label: string
    sequenceIndex: number | null
    students: number
  }[]
}

type SequenceEntry = {
  lessonId: string
  title: string
  sequenceIndex: number
  moduleTitle: string | null
}

/**
 * D-11: builds the canonical course lesson sequence — modules sorted by
 * `Module.order`, each module's lessons sorted by `Lesson.order`, then
 * module-less lessons (appended last, sorted by `Lesson.order`).
 */
function buildSequence(
  modules: { id: string; title: string; order: number; lessons: { id: string; title: string; order: number }[] }[],
  moduleLessLessons: { id: string; title: string; order: number }[]
): SequenceEntry[] {
  const sequence: SequenceEntry[] = []

  const sortedModules = [...modules].sort((a, b) => a.order - b.order)
  for (const courseModule of sortedModules) {
    const sortedLessons = [...courseModule.lessons].sort((a, b) => a.order - b.order)
    for (const lesson of sortedLessons) {
      sequence.push({
        lessonId: lesson.id,
        title: lesson.title,
        sequenceIndex: sequence.length,
        moduleTitle: courseModule.title,
      })
    }
  }

  const sortedModuleLess = [...moduleLessLessons].sort((a, b) => a.order - b.order)
  for (const lesson of sortedModuleLess) {
    sequence.push({
      lessonId: lesson.id,
      title: lesson.title,
      sequenceIndex: sequence.length,
      moduleTitle: null,
    })
  }

  return sequence
}

export async function getCourseProgressAnalytics(courseId: string): Promise<CourseProgressAnalytics> {
  const activeAccessWhere = buildActiveCourseAccessWhere()

  const [enrolledStudents, validCertificates, moduleProgressGroups, modules, moduleLessLessons, activeAccesses] =
    await Promise.all([
      db.courseAccess.count({ where: { courseId, ...activeAccessWhere } }),
      db.certificate.findMany({ where: { courseId, valid: true }, select: { userId: true }, distinct: ['userId'] }),
      db.moduleProgress.groupBy({
        by: ['moduleId'],
        where: { completed: true, module: { courseId } },
        _count: { _all: true },
      }),
      db.module.findMany({
        where: { courseId },
        select: {
          id: true,
          title: true,
          order: true,
          lessons: { select: { id: true, title: true, order: true } },
        },
      }),
      db.lesson.findMany({
        where: { courseId, moduleId: null },
        select: { id: true, title: true, order: true },
      }),
      db.courseAccess.findMany({ where: { courseId, ...activeAccessWhere }, select: { userId: true } }),
    ])

  const completedStudents = new Set(validCertificates.map((c) => c.userId)).size
  const completionRate = enrolledStudents > 0 ? Math.round((completedStudents / enrolledStudents) * 100) : 0

  const moduleCompletionByModuleId = new Map<string, number>()
  for (const group of moduleProgressGroups as { moduleId: string; _count: { _all: number } }[]) {
    moduleCompletionByModuleId.set(group.moduleId, group._count._all)
  }

  const moduleResults = [...modules]
    .sort((a, b) => a.order - b.order)
    .map((courseModule) => ({
      moduleId: courseModule.id,
      title: courseModule.title,
      order: courseModule.order,
      completedStudents: moduleCompletionByModuleId.get(courseModule.id) ?? 0,
    }))

  const sequence = buildSequence(modules, moduleLessLessons)
  const sequenceByLessonId = new Map(sequence.map((entry) => [entry.lessonId, entry]))

  const activeUserIds = new Set(activeAccesses.map((a) => a.userId))

  // Only query progress rows if there is a sequence to fold over; an empty
  // course returns empty arrays without a wasted query.
  const lessonProgressRows =
    sequence.length > 0
      ? await db.lessonProgress.findMany({
          where: { lesson: { courseId } },
          select: { userId: true, lessonId: true, completed: true },
        })
      : []

  const reachedByLesson = new Map<string, number>()
  const completedByLesson = new Map<string, number>()
  const maxSequenceIndexByUser = new Map<string, number>()

  for (const row of lessonProgressRows as { userId: string; lessonId: string; completed: boolean }[]) {
    const entry = sequenceByLessonId.get(row.lessonId)
    if (!entry) continue // defensive: skip unknown lessonIds (deleted lessons, etc.)

    reachedByLesson.set(entry.lessonId, (reachedByLesson.get(entry.lessonId) ?? 0) + 1)
    if (row.completed) {
      completedByLesson.set(entry.lessonId, (completedByLesson.get(entry.lessonId) ?? 0) + 1)
    }

    if (!activeUserIds.has(row.userId)) continue
    const currentMax = maxSequenceIndexByUser.get(row.userId)
    if (currentMax === undefined || entry.sequenceIndex > currentMax) {
      maxSequenceIndexByUser.set(row.userId, entry.sequenceIndex)
    }
  }

  const lessons = sequence.map((entry) => ({
    lessonId: entry.lessonId,
    title: entry.title,
    sequenceIndex: entry.sequenceIndex,
    moduleTitle: entry.moduleTitle,
    reachedStudents: reachedByLesson.get(entry.lessonId) ?? 0,
    completedStudents: completedByLesson.get(entry.lessonId) ?? 0,
  }))

  const dropOffCountBySequenceIndex = new Map<number, number>()
  let notStartedCount = 0
  for (const userId of activeUserIds) {
    const maxIndex = maxSequenceIndexByUser.get(userId)
    if (maxIndex === undefined) {
      notStartedCount += 1
    } else {
      dropOffCountBySequenceIndex.set(maxIndex, (dropOffCountBySequenceIndex.get(maxIndex) ?? 0) + 1)
    }
  }

  const dropOff: CourseProgressAnalytics['dropOff'] =
    sequence.length === 0
      ? []
      : [
          { lessonId: null, label: 'No ha empezado', sequenceIndex: null, students: notStartedCount },
          ...sequence.map((entry) => ({
            lessonId: entry.lessonId,
            label: entry.title,
            sequenceIndex: entry.sequenceIndex,
            students: dropOffCountBySequenceIndex.get(entry.sequenceIndex) ?? 0,
          })),
        ]

  return {
    enrolledStudents,
    completedStudents,
    completionRate,
    modules: moduleResults,
    lessons,
    dropOff,
  }
}
