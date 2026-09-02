/**
 * Tests for course-progress-analytics-service.ts (Phase 3 — WS2, design §D-05/D-11 AMENDED).
 *
 * Scope is progress-only: enrollments, per-module/per-lesson progress, completion rate,
 * and drop-off. No marketing metrics, no averageScore/attempts/passRate/blockedStudents.
 * All metrics are lifetime — the service takes no date range.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/db', async () => {
  const { createDbMock } = await import('@/test/db-mock')
  return { db: createDbMock() }
})

const { db } = await import('@/lib/db')
const { getCourseProgressAnalytics } = await import('@/server/services/course-progress-analytics-service')

beforeEach(() => {
  vi.clearAllMocks()
})

function mockEmptyCourseStructure() {
  ;(db.module.findMany as any).mockResolvedValue([])
  ;(db.lesson.findMany as any).mockResolvedValue([])
}

describe('getCourseProgressAnalytics — D6 completion rate', () => {
  it('computes completionRate as completedStudents/enrolledStudents', async () => {
    ;(db.courseAccess.count as any).mockResolvedValue(10)
    ;(db.certificate.findMany as any).mockResolvedValue([
      { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }, { userId: 'u4' },
    ])
    ;(db.moduleProgress.groupBy as any).mockResolvedValue([])
    mockEmptyCourseStructure()
    ;(db.lessonProgress.findMany as any).mockResolvedValue([])
    ;(db.courseAccess.findMany as any).mockResolvedValue([])

    const result = await getCourseProgressAnalytics('course-1')

    expect(result.enrolledStudents).toBe(10)
    expect(result.completedStudents).toBe(4)
    expect(result.completionRate).toBe(40)
  })

  it('returns 0 completionRate when enrolled is 0, not NaN', async () => {
    ;(db.courseAccess.count as any).mockResolvedValue(0)
    ;(db.certificate.findMany as any).mockResolvedValue([])
    ;(db.moduleProgress.groupBy as any).mockResolvedValue([])
    mockEmptyCourseStructure()
    ;(db.lessonProgress.findMany as any).mockResolvedValue([])
    ;(db.courseAccess.findMany as any).mockResolvedValue([])

    const result = await getCourseProgressAnalytics('course-1')

    expect(result.completionRate).toBe(0)
    expect(Number.isNaN(result.completionRate)).toBe(false)
  })

  it('returns empty modules/lessons/dropOff for a course with no lessons and no modules, without throwing', async () => {
    ;(db.courseAccess.count as any).mockResolvedValue(0)
    ;(db.certificate.findMany as any).mockResolvedValue([])
    ;(db.moduleProgress.groupBy as any).mockResolvedValue([])
    mockEmptyCourseStructure()
    ;(db.lessonProgress.findMany as any).mockResolvedValue([])
    ;(db.courseAccess.findMany as any).mockResolvedValue([])

    const result = await getCourseProgressAnalytics('course-1')

    expect(result.modules).toEqual([])
    expect(result.lessons).toEqual([])
    expect(result.dropOff).toEqual([])
  })

  it('returns per-module completedStudents from moduleProgress.groupBy', async () => {
    ;(db.courseAccess.count as any).mockResolvedValue(5)
    ;(db.certificate.findMany as any).mockResolvedValue([])
    ;(db.moduleProgress.groupBy as any).mockResolvedValue([
      { moduleId: 'mod-1', _count: { _all: 3 } },
    ])
    ;(db.module.findMany as any).mockResolvedValue([
      { id: 'mod-1', title: 'Módulo 1', order: 0, lessons: [] },
    ])
    ;(db.lesson.findMany as any).mockResolvedValue([])
    ;(db.lessonProgress.findMany as any).mockResolvedValue([])
    ;(db.courseAccess.findMany as any).mockResolvedValue([])

    const result = await getCourseProgressAnalytics('course-1')

    expect(result.modules).toEqual([
      { moduleId: 'mod-1', title: 'Módulo 1', order: 0, completedStudents: 3 },
    ])
  })
})

describe('getCourseProgressAnalytics — D-11 last-lesson-reached', () => {
  /**
   * Fixture built so that `(Module.order, Lesson.order)` sequencing and
   * lexicographic-cuid sequencing produce DIFFERENT orderings. Lesson ids are
   * deliberately reverse-alphabetical relative to their intended order, so a
   * `groupBy({ _max: { lessonId } })` implementation would pick the wrong
   * "last reached" lesson.
   */
  function mockOrderingFixture() {
    ;(db.courseAccess.count as any).mockResolvedValue(2)
    ;(db.certificate.findMany as any).mockResolvedValue([])
    ;(db.moduleProgress.groupBy as any).mockResolvedValue([])
    // Module order 0 has lesson "zzz-first" (order 0) — intended sequenceIndex 0
    // Module order 1 has lesson "aaa-second" (order 0) — intended sequenceIndex 1
    // A lexicographic-cuid max would pick "zzz-first" as "largest", which is WRONG:
    // the true last-reached lesson (by course order) is "aaa-second".
    ;(db.module.findMany as any).mockResolvedValue([
      { id: 'mod-0', title: 'Módulo A', order: 0, lessons: [{ id: 'zzz-first', title: 'Lección 1', order: 0 }] },
      { id: 'mod-1', title: 'Módulo B', order: 1, lessons: [{ id: 'aaa-second', title: 'Lección 2', order: 0 }] },
    ])
    ;(db.lesson.findMany as any).mockResolvedValue([]) // no module-less lessons
  }

  it('sequences lessons by (Module.order, Lesson.order), not by lexicographic lessonId', async () => {
    mockOrderingFixture()
    ;(db.lessonProgress.findMany as any).mockResolvedValue([
      { userId: 'student-1', lessonId: 'zzz-first', completed: false },
      { userId: 'student-1', lessonId: 'aaa-second', completed: false },
    ])
    ;(db.courseAccess.findMany as any).mockResolvedValue([{ userId: 'student-1' }])

    const result = await getCourseProgressAnalytics('course-1')

    const zzz = result.lessons.find((l) => l.lessonId === 'zzz-first')
    const aaa = result.lessons.find((l) => l.lessonId === 'aaa-second')
    expect(zzz?.sequenceIndex).toBe(0)
    expect(aaa?.sequenceIndex).toBe(1)

    // A groupBy-_max(lessonId) implementation would bucket student-1 at
    // "zzz-first" (lexicographically largest). The correct bucket, by course
    // order, is "aaa-second" (sequenceIndex 1, the higher true sequence position).
    const dropOffBucket = result.dropOff.find((d) => d.students > 0)
    expect(dropOffBucket?.lessonId).toBe('aaa-second')
    expect(dropOffBucket?.lessonId).not.toBe('zzz-first')
  })

  it('appends module-less lessons last in the sequence', async () => {
    ;(db.courseAccess.count as any).mockResolvedValue(1)
    ;(db.certificate.findMany as any).mockResolvedValue([])
    ;(db.moduleProgress.groupBy as any).mockResolvedValue([])
    ;(db.module.findMany as any).mockResolvedValue([
      { id: 'mod-0', title: 'Módulo A', order: 0, lessons: [{ id: 'in-module', title: 'Lección en módulo', order: 0 }] },
    ])
    ;(db.lesson.findMany as any).mockResolvedValue([
      { id: 'course-level', title: 'Lección suelta', order: 0, moduleId: null },
    ])
    ;(db.lessonProgress.findMany as any).mockResolvedValue([])
    ;(db.courseAccess.findMany as any).mockResolvedValue([])

    const result = await getCourseProgressAnalytics('course-1')

    const inModule = result.lessons.find((l) => l.lessonId === 'in-module')
    const courseLevel = result.lessons.find((l) => l.lessonId === 'course-level')
    expect(inModule?.sequenceIndex).toBe(0)
    expect(courseLevel?.sequenceIndex).toBe(1)
    expect(courseLevel?.moduleTitle).toBeNull()
  })

  it('buckets a student with zero LessonProgress rows as "no ha empezado", not lesson index 0', async () => {
    mockOrderingFixture()
    ;(db.lessonProgress.findMany as any).mockResolvedValue([])
    ;(db.courseAccess.findMany as any).mockResolvedValue([{ userId: 'never-started' }])

    const result = await getCourseProgressAnalytics('course-1')

    const notStartedBucket = result.dropOff.find((d) => d.lessonId === null)
    expect(notStartedBucket).toBeDefined()
    expect(notStartedBucket?.students).toBe(1)
    const zeroIndexBucket = result.dropOff.find((d) => d.sequenceIndex === 0)
    expect(zeroIndexBucket?.students ?? 0).toBe(0)
  })

  it('reachedStudents counts row presence while completedStudents counts the completed flag', async () => {
    mockOrderingFixture()
    ;(db.lessonProgress.findMany as any).mockResolvedValue([
      { userId: 'student-1', lessonId: 'zzz-first', completed: false },
      { userId: 'student-2', lessonId: 'zzz-first', completed: true },
    ])
    ;(db.courseAccess.findMany as any).mockResolvedValue([{ userId: 'student-1' }, { userId: 'student-2' }])

    const result = await getCourseProgressAnalytics('course-1')

    const zzz = result.lessons.find((l) => l.lessonId === 'zzz-first')
    expect(zzz?.reachedStudents).toBe(2)
    expect(zzz?.completedStudents).toBe(1)
  })
})
