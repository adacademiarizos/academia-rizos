/**
 * Unified read model for the admin "Intentos" tab (design §D-02/D-02b).
 *
 * The admin first picks ONE test/exam from a flat selector spanning all three
 * attempt systems (`listCourseAttemptTargets`), then loads that single
 * target's blocked students (`listBlockedStudentsForTarget`). There is
 * deliberately no combined whole-course listing function — it was superseded
 * by this two-step shape (design §5, "REMOVED: listBlockedStudents(courseId)").
 */
import { db } from '@/lib/db'
import { AcademyAssessmentError } from '@/server/services/academy-assessment-service'

export type AttemptSystem = 'ASSESSMENT' | 'LESSON_TEST' | 'FINAL_EXAM'

export type AttemptTarget = {
  system: AttemptSystem
  targetId: string
  title: string
  scopeLabel: string
  baseMaxAttempts: number
}

export type BlockedAttemptRow = {
  system: AttemptSystem
  targetId: string
  targetTitle: string
  scopeLabel: string
  student: { id: string; name: string | null; email: string | null }
  attemptsUsed: number
  attemptsAllowed: number
  lastAttemptAt: Date | null
  lastStatus: string | null
  grantEndpoint: string
}

function assessmentScopeLabel(assessment: {
  module: { title: string } | null
  style: { name: string } | null
  lesson: { title: string } | null
}): string {
  if (assessment.module) return `Módulo: ${assessment.module.title}`
  if (assessment.style) return `Estilo: ${assessment.style.name}`
  if (assessment.lesson) return `Lección: ${assessment.lesson.title}`
  return 'Curso'
}

/**
 * One flat, ordered list mixing all three attempt systems. Titles and
 * `maxAttempts` only — no attempt data, so this is safe to fetch on tab open
 * without exposing a cross-test student/email set (design §10).
 */
export async function listCourseAttemptTargets(courseId: string): Promise<AttemptTarget[]> {
  const [assessments, lessonTests, finalExam] = await Promise.all([
    db.assessment.findMany({
      where: {
        OR: [
          { courseId },
          { module: { courseId } },
          { style: { courseId } },
          { lesson: { courseId } },
        ],
      },
      select: {
        id: true,
        title: true,
        maxAttempts: true,
        module: { select: { title: true } },
        style: { select: { name: true } },
        lesson: { select: { title: true } },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    }),
    db.lessonTest.findMany({
      where: { lesson: { courseId } },
      select: {
        id: true,
        title: true,
        maxAttempts: true,
        lesson: { select: { title: true } },
      },
      orderBy: { order: 'asc' },
    }),
    db.finalExam.findUnique({
      where: { courseId },
      select: { id: true, title: true, maxAttempts: true },
    }),
  ])

  const assessmentTargets: AttemptTarget[] = assessments.map((assessment) => ({
    system: 'ASSESSMENT',
    targetId: assessment.id,
    title: assessment.title,
    scopeLabel: assessmentScopeLabel(assessment),
    baseMaxAttempts: assessment.maxAttempts,
  }))

  const lessonTestTargets: AttemptTarget[] = lessonTests.map((test) => ({
    system: 'LESSON_TEST',
    targetId: test.id,
    title: test.title,
    scopeLabel: `Lección: ${test.lesson.title}`,
    baseMaxAttempts: test.maxAttempts,
  }))

  const finalExamTargets: AttemptTarget[] = finalExam
    ? [
        {
          system: 'FINAL_EXAM',
          targetId: finalExam.id,
          title: finalExam.title,
          scopeLabel: 'Curso',
          baseMaxAttempts: finalExam.maxAttempts,
        },
      ]
    : []

  // Final exam pinned last (design §D-02b).
  return [...assessmentTargets, ...lessonTestTargets, ...finalExamTargets]
}

export async function listBlockedStudentsForTarget(
  courseId: string,
  system: AttemptSystem,
  targetId: string
): Promise<BlockedAttemptRow[]> {
  switch (system) {
    case 'ASSESSMENT':
      return listBlockedForAssessment(courseId, targetId)
    case 'LESSON_TEST':
      return listBlockedForLessonTest(courseId, targetId)
    case 'FINAL_EXAM':
      return listBlockedForFinalExam(courseId, targetId)
    default:
      throw new AcademyAssessmentError('ATTEMPT_SYSTEM_INVALID', 'Sistema de intentos inválido.', 400)
  }
}

async function listBlockedForLessonTest(courseId: string, testId: string): Promise<BlockedAttemptRow[]> {
  // `courseId` is an authorization argument: a testId from another course must
  // be rejected, not silently read (design §D-02).
  const test = await db.lessonTest.findFirst({
    where: { id: testId, lesson: { courseId } },
    select: { id: true, lessonId: true, title: true, maxAttempts: true, lesson: { select: { title: true } } },
  })
  if (!test) throw new AcademyAssessmentError('ATTEMPT_TARGET_NOT_FOUND', 'El test no pertenece a este curso.', 404)

  const [submissionStats, passedSubmissions, grants] = await Promise.all([
    db.lessonTestSubmission.groupBy({
      by: ['userId'],
      where: { lessonTestId: testId },
      _count: { _all: true },
      _max: { submittedAt: true },
    }),
    db.lessonTestSubmission.findMany({
      where: { lessonTestId: testId, isPassed: true },
      select: { userId: true },
    }),
    db.lessonTestRevalidation.groupBy({
      by: ['userId'],
      where: { lessonTestId: testId },
      _sum: { attemptsGranted: true },
    }),
  ])

  const passedUserIds = new Set(passedSubmissions.map((submission) => submission.userId))
  const grantsByUser = new Map(grants.map((grant) => [grant.userId, grant._sum.attemptsGranted ?? 0]))

  const blocked = submissionStats.filter((stat) => {
    if (passedUserIds.has(stat.userId)) return false
    const attemptsAllowed = test.maxAttempts + (grantsByUser.get(stat.userId) ?? 0)
    return stat._count._all >= attemptsAllowed
  })
  if (blocked.length === 0) return []

  const students = await db.user.findMany({
    where: { id: { in: blocked.map((stat) => stat.userId) } },
    select: { id: true, name: true, email: true },
  })
  const studentById = new Map(students.map((student) => [student.id, student]))

  return blocked.map((stat) => ({
    system: 'LESSON_TEST' as const,
    targetId: test.id,
    targetTitle: test.title,
    scopeLabel: `Lección: ${test.lesson.title}`,
    student: studentById.get(stat.userId) ?? { id: stat.userId, name: null, email: null },
    attemptsUsed: stat._count._all,
    attemptsAllowed: test.maxAttempts + (grantsByUser.get(stat.userId) ?? 0),
    lastAttemptAt: stat._max.submittedAt ?? null,
    // Lesson tests are auto-scored — there is no PENDING_REVIEW state to wait on
    // (design §D-04). A blocked, unpassed row's latest submission is NOT_PASSED.
    lastStatus: 'NOT_PASSED',
    grantEndpoint: `/api/admin/lessons/${test.lessonId}/tests/${test.id}/revalidations`,
  }))
}

async function listBlockedForAssessment(courseId: string, assessmentId: string): Promise<BlockedAttemptRow[]> {
  const assessment = await db.assessment.findFirst({
    where: {
      id: assessmentId,
      OR: [
        { courseId },
        { module: { courseId } },
        { style: { courseId } },
        { lesson: { courseId } },
      ],
    },
    select: {
      id: true,
      title: true,
      maxAttempts: true,
      module: { select: { title: true } },
      style: { select: { name: true } },
      lesson: { select: { title: true } },
    },
  })
  if (!assessment) {
    throw new AcademyAssessmentError('ATTEMPT_TARGET_NOT_FOUND', 'La evaluación no pertenece a este curso.', 404)
  }

  const [attemptStats, approvedAttempts, grants] = await Promise.all([
    db.assessmentAttempt.groupBy({
      by: ['userId'],
      where: { assessmentId },
      _count: { _all: true },
      _max: { submittedAt: true },
    }),
    db.assessmentAttempt.findMany({
      where: { assessmentId, status: 'APPROVED' },
      select: { userId: true },
    }),
    db.assessmentRevalidation.groupBy({
      by: ['userId'],
      where: { assessmentId },
      _sum: { attemptsGranted: true },
    }),
  ])

  const passedUserIds = new Set(approvedAttempts.map((attempt) => attempt.userId))
  const grantsByUser = new Map(grants.map((grant) => [grant.userId, grant._sum.attemptsGranted ?? 0]))

  const blocked = attemptStats.filter((stat) => {
    if (passedUserIds.has(stat.userId)) return false
    const attemptsAllowed = assessment.maxAttempts + (grantsByUser.get(stat.userId) ?? 0)
    return stat._count._all >= attemptsAllowed
  })
  if (blocked.length === 0) return []

  const [students, latestAttempts] = await Promise.all([
    db.user.findMany({
      where: { id: { in: blocked.map((stat) => stat.userId) } },
      select: { id: true, name: true, email: true },
    }),
    db.assessmentAttempt.findMany({
      where: { assessmentId, userId: { in: blocked.map((stat) => stat.userId) } },
      orderBy: { attemptNumber: 'desc' },
      select: { userId: true, status: true },
      distinct: ['userId'],
    }),
  ])
  const studentById = new Map(students.map((student) => [student.id, student]))
  const statusByUser = new Map(latestAttempts.map((attempt) => [attempt.userId, attempt.status]))
  const scopeLabel = assessmentScopeLabel(assessment)

  return blocked.map((stat) => ({
    system: 'ASSESSMENT' as const,
    targetId: assessment.id,
    targetTitle: assessment.title,
    scopeLabel,
    student: studentById.get(stat.userId) ?? { id: stat.userId, name: null, email: null },
    attemptsUsed: stat._count._all,
    attemptsAllowed: assessment.maxAttempts + (grantsByUser.get(stat.userId) ?? 0),
    lastAttemptAt: stat._max.submittedAt ?? null,
    lastStatus: statusByUser.get(stat.userId) ?? null,
    grantEndpoint: `/api/admin/assessments/${assessment.id}/revalidations`,
  }))
}

async function listBlockedForFinalExam(courseId: string, finalExamId: string): Promise<BlockedAttemptRow[]> {
  const finalExam = await db.finalExam.findFirst({
    where: { id: finalExamId, courseId },
    select: { id: true, title: true, maxAttempts: true },
  })
  if (!finalExam) {
    throw new AcademyAssessmentError('ATTEMPT_TARGET_NOT_FOUND', 'El examen final no pertenece a este curso.', 404)
  }

  const [attemptStats, approvedAttempts, grants] = await Promise.all([
    db.finalExamAttempt.groupBy({
      by: ['userId'],
      where: { finalExamId },
      _count: { _all: true },
      _max: { submittedAt: true },
    }),
    db.finalExamAttempt.findMany({
      where: { finalExamId, status: 'APPROVED' },
      select: { userId: true },
    }),
    db.finalExamRevalidation.groupBy({
      by: ['userId'],
      where: { finalExamId },
      _sum: { attemptsGranted: true },
    }),
  ])

  const passedUserIds = new Set(approvedAttempts.map((attempt) => attempt.userId))
  const grantsByUser = new Map(grants.map((grant) => [grant.userId, grant._sum.attemptsGranted ?? 0]))

  const blocked = attemptStats.filter((stat) => {
    if (passedUserIds.has(stat.userId)) return false
    const attemptsAllowed = finalExam.maxAttempts + (grantsByUser.get(stat.userId) ?? 0)
    return stat._count._all >= attemptsAllowed
  })
  if (blocked.length === 0) return []

  const [students, latestAttempts] = await Promise.all([
    db.user.findMany({
      where: { id: { in: blocked.map((stat) => stat.userId) } },
      select: { id: true, name: true, email: true },
    }),
    db.finalExamAttempt.findMany({
      where: { finalExamId, userId: { in: blocked.map((stat) => stat.userId) } },
      orderBy: { attemptNumber: 'desc' },
      select: { userId: true, status: true },
      distinct: ['userId'],
    }),
  ])
  const studentById = new Map(students.map((student) => [student.id, student]))
  const statusByUser = new Map(latestAttempts.map((attempt) => [attempt.userId, attempt.status]))

  return blocked.map((stat) => ({
    system: 'FINAL_EXAM' as const,
    targetId: finalExam.id,
    targetTitle: finalExam.title,
    scopeLabel: 'Curso',
    student: studentById.get(stat.userId) ?? { id: stat.userId, name: null, email: null },
    attemptsUsed: stat._count._all,
    attemptsAllowed: finalExam.maxAttempts + (grantsByUser.get(stat.userId) ?? 0),
    lastAttemptAt: stat._max.submittedAt ?? null,
    lastStatus: statusByUser.get(stat.userId) ?? null,
    grantEndpoint: `/api/admin/courses/${courseId}/final-exam/revalidations`,
  }))
}
