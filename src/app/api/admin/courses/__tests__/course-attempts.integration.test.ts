/**
 * Integration tests for the Phase 1 (WS1) Attempts tab routes (design §D-02/D-02b/D-03).
 * Seeds one blocked student per attempt system, exercises the real selector +
 * scoped query + grant flow against a real Postgres instance.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LearningScope } from '@prisma/client'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { GET as getTargets } from '@/app/api/admin/courses/[courseId]/attempts/targets/route'
import { GET as getBlockedStudents } from '@/app/api/admin/courses/[courseId]/attempts/route'
import { POST as postLessonTestRevalidation } from '@/app/api/admin/lessons/[lessonId]/tests/[testId]/revalidations/route'

function asAdmin(email: string) {
  ;(getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { email } })
}

function asAnonymous() {
  ;(getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)
}

function attemptsUrl(courseId: string, system?: string, targetId?: string) {
  const url = new URL(`http://localhost/api/admin/courses/${courseId}/attempts`)
  if (system) url.searchParams.set('system', system)
  if (targetId) url.searchParams.set('targetId', targetId)
  return new Request(url)
}

describe('course-attempts integration (Phase 1 — WS1)', () => {
  afterAll(async () => {
    await db.$disconnect()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists all 3 targets, scopes blocked students to one target, grants, and re-scoping shows the row gone', async () => {
    const admin = await db.user.create({
      data: { email: `admin-${crypto.randomUUID()}@example.com`, role: 'ADMIN' },
      select: { id: true, email: true },
    })
    const student = await db.user.create({
      data: { email: `student-${crypto.randomUUID()}@example.com`, role: 'STUDENT' },
      select: { id: true },
    })
    const course = await db.course.create({
      data: { title: `Attempts ${crypto.randomUUID()}`, priceCents: 0 },
      select: { id: true },
    })
    const otherCourse = await db.course.create({
      data: { title: `Other ${crypto.randomUUID()}`, priceCents: 0 },
      select: { id: true },
    })

    try {
      const courseModule = await db.module.create({
        data: { courseId: course.id, order: 0, title: 'Module 1' },
        select: { id: true },
      })
      const lesson = await db.lesson.create({
        data: { courseId: course.id, moduleId: courseModule.id, order: 0, title: 'Lesson 1' },
        select: { id: true, courseId: true },
      })
      const lessonTest = await db.lessonTest.create({
        data: { lessonId: lesson.id, title: 'Lesson test', maxAttempts: 1, passingScore: 70 },
        select: { id: true, maxAttempts: true },
      })
      const assessment = await db.assessment.create({
        data: { scope: LearningScope.COURSE, courseId: course.id, title: 'Assessment', maxAttempts: 1 },
        select: { id: true },
      })
      const finalExam = await db.finalExam.create({
        data: { courseId: course.id, title: 'Final exam', maxAttempts: 1 },
        select: { id: true },
      })
      // A lesson test that belongs to a different course — used to assert
      // cross-course targetId rejection below.
      const otherModule = await db.module.create({
        data: { courseId: otherCourse.id, order: 0, title: 'Other module' },
        select: { id: true },
      })
      const otherLesson = await db.lesson.create({
        data: { courseId: otherCourse.id, moduleId: otherModule.id, order: 0, title: 'Other lesson' },
        select: { id: true },
      })
      const otherLessonTest = await db.lessonTest.create({
        data: { lessonId: otherLesson.id, title: 'Other test', maxAttempts: 1, passingScore: 70 },
        select: { id: true },
      })

      // Seed one blocked (exhausted, not passed) student per system.
      await db.lessonTestSubmission.create({
        data: { lessonTestId: lessonTest.id, userId: student.id, score: 40, isPassed: false, attemptNumber: 1 },
      })
      await db.assessmentAttempt.create({
        data: { assessmentId: assessment.id, userId: student.id, attemptNumber: 1, status: 'NOT_PASSED' },
      })
      await db.finalExamAttempt.create({
        data: { finalExamId: finalExam.id, userId: student.id, attemptNumber: 1, status: 'NOT_PASSED' },
      })

      asAdmin(admin.email!)

      // 1) Targets selector returns all three systems.
      const targetsResponse = await getTargets(new Request(`http://localhost/api/admin/courses/${course.id}/attempts/targets`), {
        params: Promise.resolve({ courseId: course.id }),
      })
      expect(targetsResponse.status).toBe(200)
      const targetsBody = await targetsResponse.json()
      expect(targetsBody.success).toBe(true)
      const systems = targetsBody.data.map((target: { system: string }) => target.system)
      expect(systems).toEqual(expect.arrayContaining(['ASSESSMENT', 'LESSON_TEST', 'FINAL_EXAM']))
      expect(targetsBody.data[targetsBody.data.length - 1].system).toBe('FINAL_EXAM')

      // 2) Scoped query for the LessonTest target returns exactly the one blocked student.
      const blockedResponse = await getBlockedStudents(attemptsUrl(course.id, 'LESSON_TEST', lessonTest.id), {
        params: Promise.resolve({ courseId: course.id }),
      })
      expect(blockedResponse.status).toBe(200)
      const blockedBody = await blockedResponse.json()
      expect(blockedBody.data).toHaveLength(1)
      expect(blockedBody.data[0]).toMatchObject({
        system: 'LESSON_TEST',
        targetId: lessonTest.id,
        student: { id: student.id },
        attemptsUsed: 1,
        attemptsAllowed: 1,
      })

      // 3) Grant a lesson test revalidation.
      const grantRequest = new Request(`http://localhost/api/admin/lessons/${lesson.id}/tests/${lessonTest.id}/revalidations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: student.id, attemptsGranted: 1 }),
      })
      const grantResponse = await postLessonTestRevalidation(grantRequest, {
        params: Promise.resolve({ lessonId: lesson.id, testId: lessonTest.id }),
      })
      expect(grantResponse.status).toBe(201)

      // 4) Re-GET the same target: the row is gone, cap incremented.
      const afterGrantResponse = await getBlockedStudents(attemptsUrl(course.id, 'LESSON_TEST', lessonTest.id), {
        params: Promise.resolve({ courseId: course.id }),
      })
      const afterGrantBody = await afterGrantResponse.json()
      expect(afterGrantBody.data).toEqual([])

      // 5) A targetId from a different course must be rejected, not silently scoped.
      const crossCourseResponse = await getBlockedStudents(attemptsUrl(course.id, 'LESSON_TEST', otherLessonTest.id), {
        params: Promise.resolve({ courseId: course.id }),
      })
      expect(crossCourseResponse.status).toBe(404)

      // 6) Non-admin gets 403 on both routes.
      asAnonymous()
      const anonTargetsResponse = await getTargets(new Request(`http://localhost/api/admin/courses/${course.id}/attempts/targets`), {
        params: Promise.resolve({ courseId: course.id }),
      })
      expect(anonTargetsResponse.status).toBe(403)
      const anonBlockedResponse = await getBlockedStudents(attemptsUrl(course.id, 'LESSON_TEST', lessonTest.id), {
        params: Promise.resolve({ courseId: course.id }),
      })
      expect(anonBlockedResponse.status).toBe(403)
    } finally {
      await db.lessonTestRevalidation.deleteMany({ where: { lessonTest: { lesson: { courseId: { in: [course.id, otherCourse.id] } } } } })
      await db.course.delete({ where: { id: course.id } })
      await db.course.delete({ where: { id: otherCourse.id } })
      await db.user.delete({ where: { id: admin.id } })
      await db.user.delete({ where: { id: student.id } })
    }
  })
})
