/**
 * Tests for course-attempts-service.ts (Phase 1 — WS1, design §D-02/D-02b AMENDED).
 *
 * The admin selects ONE test/exam at a time: `listCourseAttemptTargets` returns
 * the flat selector, `listBlockedStudentsForTarget` returns that one target's
 * blocked students. There is no combined whole-course listing function.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/db', async () => {
  const { createDbMock } = await import('@/test/db-mock')
  return { db: createDbMock() }
})

const { db } = await import('@/lib/db')
const {
  listCourseAttemptTargets,
  listBlockedStudentsForTarget,
} = await import('@/server/services/course-attempts-service')
const { AcademyAssessmentError } = await import('@/server/services/academy-assessment-service')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listCourseAttemptTargets', () => {
  it('returns all three systems in one ordered flat list, final exam pinned last', async () => {
    ;(db.assessment.findMany as any).mockResolvedValue([
      {
        id: 'assessment-1',
        title: 'Evaluación de módulo',
        maxAttempts: 2,
        module: { title: 'Módulo 1' },
        style: null,
        lesson: null,
      },
    ])
    ;(db.lessonTest.findMany as any).mockResolvedValue([
      {
        id: 'test-1',
        title: 'Test de lección',
        maxAttempts: 3,
        lesson: { title: 'Lección 1' },
      },
    ])
    ;(db.finalExam.findUnique as any).mockResolvedValue({
      id: 'final-exam-1',
      title: 'Examen final',
      maxAttempts: 1,
    })

    const targets = await listCourseAttemptTargets('course-1')

    expect(targets).toEqual([
      {
        system: 'ASSESSMENT',
        targetId: 'assessment-1',
        title: 'Evaluación de módulo',
        scopeLabel: 'Módulo: Módulo 1',
        baseMaxAttempts: 2,
      },
      {
        system: 'LESSON_TEST',
        targetId: 'test-1',
        title: 'Test de lección',
        scopeLabel: 'Lección: Lección 1',
        baseMaxAttempts: 3,
      },
      {
        system: 'FINAL_EXAM',
        targetId: 'final-exam-1',
        title: 'Examen final',
        scopeLabel: 'Curso',
        baseMaxAttempts: 1,
      },
    ])
    expect(targets[targets.length - 1].system).toBe('FINAL_EXAM')
  })

  it('returns an empty list for a course with no tests', async () => {
    ;(db.assessment.findMany as any).mockResolvedValue([])
    ;(db.lessonTest.findMany as any).mockResolvedValue([])
    ;(db.finalExam.findUnique as any).mockResolvedValue(null)

    const targets = await listCourseAttemptTargets('course-empty')
    expect(targets).toEqual([])
  })
})

describe('listBlockedStudentsForTarget — LESSON_TEST', () => {
  it('applies the D-04 blocked predicate, sums multiple grants, and never blocks a passed student', async () => {
    ;(db.lessonTest.findFirst as any).mockResolvedValue({
      id: 'test-1',
      lessonId: 'lesson-1',
      title: 'Test de lección',
      maxAttempts: 2,
      lesson: { title: 'Lección 1' },
    })
    ;(db.lessonTestSubmission.groupBy as any).mockResolvedValue([
      { userId: 'user-blocked', _count: { _all: 3 }, _max: { submittedAt: new Date('2026-01-01') } },
      { userId: 'user-passed', _count: { _all: 2 }, _max: { submittedAt: new Date('2026-01-02') } },
      { userId: 'user-not-exhausted', _count: { _all: 1 }, _max: { submittedAt: new Date('2026-01-03') } },
    ])
    ;(db.lessonTestSubmission.findMany as any).mockResolvedValue([{ userId: 'user-passed' }])
    ;(db.lessonTestRevalidation.groupBy as any).mockResolvedValue([
      { userId: 'user-blocked', _sum: { attemptsGranted: 0 } },
    ])
    ;(db.user.findMany as any).mockResolvedValue([
      { id: 'user-blocked', name: 'Blocked Student', email: 'blocked@example.com' },
    ])

    const rows = await listBlockedStudentsForTarget('course-1', 'LESSON_TEST', 'test-1')

    expect(rows).toEqual([
      {
        system: 'LESSON_TEST',
        targetId: 'test-1',
        targetTitle: 'Test de lección',
        scopeLabel: 'Lección: Lección 1',
        student: { id: 'user-blocked', name: 'Blocked Student', email: 'blocked@example.com' },
        attemptsUsed: 3,
        attemptsAllowed: 2,
        lastAttemptAt: new Date('2026-01-01'),
        lastStatus: 'NOT_PASSED',
        grantEndpoint: '/api/admin/lessons/lesson-1/tests/test-1/revalidations',
      },
    ])
  })

  it('sums multiple grants into the cap so a granted student is no longer blocked', async () => {
    ;(db.lessonTest.findFirst as any).mockResolvedValue({
      id: 'test-1',
      lessonId: 'lesson-1',
      title: 'Test de lección',
      maxAttempts: 1,
      lesson: { title: 'Lección 1' },
    })
    ;(db.lessonTestSubmission.groupBy as any).mockResolvedValue([
      { userId: 'user-granted', _count: { _all: 3 }, _max: { submittedAt: new Date('2026-01-01') } },
    ])
    ;(db.lessonTestSubmission.findMany as any).mockResolvedValue([])
    ;(db.lessonTestRevalidation.groupBy as any).mockResolvedValue([
      { userId: 'user-granted', _sum: { attemptsGranted: 3 } }, // e.g. two separate grants summed to 3
    ])
    ;(db.user.findMany as any).mockResolvedValue([])

    const rows = await listBlockedStudentsForTarget('course-1', 'LESSON_TEST', 'test-1')
    expect(rows).toEqual([])
  })

  it('rejects a targetId that does not belong to courseId', async () => {
    ;(db.lessonTest.findFirst as any).mockResolvedValue(null)

    await expect(
      listBlockedStudentsForTarget('course-1', 'LESSON_TEST', 'test-from-another-course')
    ).rejects.toBeInstanceOf(AcademyAssessmentError)
    // Ownership must be checked before any attempt data is read.
    expect(db.lessonTestSubmission.groupBy).not.toHaveBeenCalled()
  })
})

describe('listBlockedStudentsForTarget — grantEndpoint per system', () => {
  it('matches grantEndpoint to system for ASSESSMENT', async () => {
    ;(db.assessment.findFirst as any).mockResolvedValue({
      id: 'assessment-1',
      title: 'Evaluación',
      maxAttempts: 1,
      module: null,
      style: null,
      lesson: null,
    })
    ;(db.assessmentAttempt.groupBy as any).mockResolvedValue([
      { userId: 'user-1', _count: { _all: 1 }, _max: { submittedAt: new Date('2026-01-01') } },
    ])
    ;(db.assessmentAttempt.findMany as any)
      .mockResolvedValueOnce([]) // approved attempts
      .mockResolvedValueOnce([{ userId: 'user-1', status: 'NOT_PASSED' }]) // latest attempts (distinct)
    ;(db.assessmentRevalidation.groupBy as any).mockResolvedValue([])
    ;(db.user.findMany as any).mockResolvedValue([{ id: 'user-1', name: 'A', email: 'a@example.com' }])

    const rows = await listBlockedStudentsForTarget('course-1', 'ASSESSMENT', 'assessment-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].grantEndpoint).toBe('/api/admin/assessments/assessment-1/revalidations')
  })

  it('matches grantEndpoint to system for FINAL_EXAM', async () => {
    ;(db.finalExam.findFirst as any).mockResolvedValue({ id: 'final-exam-1', title: 'Examen final', maxAttempts: 1 })
    ;(db.finalExamAttempt.groupBy as any).mockResolvedValue([
      { userId: 'user-1', _count: { _all: 1 }, _max: { submittedAt: new Date('2026-01-01') } },
    ])
    ;(db.finalExamAttempt.findMany as any)
      .mockResolvedValueOnce([]) // approved attempts
      .mockResolvedValueOnce([{ userId: 'user-1', status: 'NOT_PASSED' }]) // latest attempts (distinct)
    ;(db.finalExamRevalidation.groupBy as any).mockResolvedValue([])
    ;(db.user.findMany as any).mockResolvedValue([{ id: 'user-1', name: 'A', email: 'a@example.com' }])

    const rows = await listBlockedStudentsForTarget('course-1', 'FINAL_EXAM', 'final-exam-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].grantEndpoint).toBe('/api/admin/courses/course-1/final-exam/revalidations')
  })
})
