/**
 * Characterization tests for academy-assessment-service.ts (Phase 0 — WS0).
 * Pins current behavior before WS1 (LessonTestRevalidation) and WS-D
 * (certificateSlogan removal) touch this file. Zero production change.
 *
 * Note: `COURSE_CERTIFICATE_SLOGAN_MISSING` -> 409 is deliberately NOT pinned
 * here — WS-D deletes that behavior in this same PR (design §D-13).
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { db } from '@/lib/db'
import { generateAndSaveCertificate } from '@/server/services/certificate.service'
import {
  AcademyAssessmentError,
  submitLessonTest,
  getStudentLessonTests,
  grantLessonTestRevalidation,
  grantFinalExamRevalidation,
  reviewFinalExamAttempt,
} from '@/server/services/academy-assessment-service'

vi.mock('@/lib/db', () => ({
  db: {
    lessonTest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    lessonTestSubmission: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    lessonTestRevalidation: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    lessonProgress: {
      findUnique: vi.fn(),
    },
    lesson: {
      findUnique: vi.fn(),
    },
    assessment: {
      findMany: vi.fn(),
    },
    assessmentAttempt: {
      findMany: vi.fn(),
    },
    finalExam: {
      findUnique: vi.fn(),
    },
    finalExamAttempt: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    finalExamRevalidation: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/server/services/certificate.service', () => ({
  generateAndSaveCertificate: vi.fn(),
}))

vi.mock('@/server/services/notification-event-service', () => ({
  NotificationEventService: {
    attemptsGranted: vi.fn(),
  },
}))

import { NotificationEventService } from '@/server/services/notification-event-service'

const notificationMock = NotificationEventService as unknown as {
  attemptsGranted: Mock
}

const dbMock = db as unknown as {
  lessonTest: { findFirst: Mock; findMany: Mock }
  lessonTestSubmission: { findMany: Mock; create: Mock }
  lessonTestRevalidation: { aggregate: Mock; create: Mock }
  lessonProgress: { findUnique: Mock }
  finalExam: { findUnique: Mock }
  finalExamAttempt: { findMany: Mock; findFirst: Mock; update: Mock }
  finalExamRevalidation: { aggregate: Mock; create: Mock }
  course: { findUnique: Mock }
  $transaction: Mock
}

describe('academy-assessment-service (characterization)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(dbMock))
    ;(db.course.findUnique as Mock).mockResolvedValue({ id: 'course-1' })
    // Default: no grants. Individual tests override to exercise the
    // maxAttempts + Σ attemptsGranted cap (design §D-04).
    dbMock.lessonTestRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: null } })
    notificationMock.attemptsGranted.mockResolvedValue(undefined)
  })

  describe('submitLessonTest (0.1)', () => {
    const baseTest = {
      id: 'test-1',
      lessonId: 'lesson-1',
      maxAttempts: 2,
      passingScore: 70,
      questions: [{ id: 'q1', correctAnswer: 'A' }],
      lesson: { courseId: 'course-1' },
    }

    it('throws LESSON_TEST_ATTEMPTS_EXHAUSTED when used attempts >= maxAttempts', async () => {
      dbMock.lessonTest.findFirst.mockResolvedValue(baseTest)
      dbMock.lessonTestSubmission.findMany.mockResolvedValue([
        { attemptNumber: 1, isPassed: false },
        { attemptNumber: 2, isPassed: false },
      ])

      await expect(
        submitLessonTest('user-1', 'lesson-1', 'test-1', { q1: 'A' })
      ).rejects.toMatchObject({ code: 'LESSON_TEST_ATTEMPTS_EXHAUSTED' })
      expect(dbMock.lessonTestSubmission.create).not.toHaveBeenCalled()
    })

    it('throws LESSON_TEST_ALREADY_PASSED when a prior submission already passed', async () => {
      dbMock.lessonTest.findFirst.mockResolvedValue(baseTest)
      dbMock.lessonTestSubmission.findMany.mockResolvedValue([
        { attemptNumber: 1, isPassed: true },
      ])

      await expect(
        submitLessonTest('user-1', 'lesson-1', 'test-1', { q1: 'A' })
      ).rejects.toMatchObject({ code: 'LESSON_TEST_ALREADY_PASSED' })
      expect(dbMock.lessonTestSubmission.create).not.toHaveBeenCalled()
    })
  })

  describe('submitLessonTest — granted attempts (1.5/1.6)', () => {
    const baseTest = {
      id: 'test-1',
      lessonId: 'lesson-1',
      maxAttempts: 2,
      passingScore: 70,
      questions: [{ id: 'q1', correctAnswer: 'A' }],
      lesson: { courseId: 'course-1' },
    }

    it('admits an attempt beyond maxAttempts once a revalidation was granted', async () => {
      dbMock.lessonTest.findFirst.mockResolvedValue(baseTest)
      dbMock.lessonTestSubmission.findMany.mockResolvedValue([
        { attemptNumber: 1, isPassed: false },
        { attemptNumber: 2, isPassed: false },
      ])
      dbMock.lessonTestRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: 1 } })
      dbMock.lessonTestSubmission.create.mockResolvedValue({
        id: 'submission-3',
        attemptNumber: 3,
        isPassed: false,
        score: 0,
      })

      const result = await submitLessonTest('user-1', 'lesson-1', 'test-1', { q1: 'B' })

      expect(dbMock.lessonTestSubmission.create).toHaveBeenCalledTimes(1)
      expect(result?.submission).toMatchObject({ attemptNumber: 3 })
    })

    it('still throws LESSON_TEST_ATTEMPTS_EXHAUSTED when granted attempts are also used up', async () => {
      dbMock.lessonTest.findFirst.mockResolvedValue(baseTest)
      dbMock.lessonTestSubmission.findMany.mockResolvedValue([
        { attemptNumber: 1, isPassed: false },
        { attemptNumber: 2, isPassed: false },
        { attemptNumber: 3, isPassed: false },
      ])
      dbMock.lessonTestRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: 1 } })

      await expect(
        submitLessonTest('user-1', 'lesson-1', 'test-1', { q1: 'A' })
      ).rejects.toMatchObject({ code: 'LESSON_TEST_ATTEMPTS_EXHAUSTED' })
      expect(dbMock.lessonTestSubmission.create).not.toHaveBeenCalled()
    })
  })

  describe('getStudentLessonTests — granted attempts (1.6)', () => {
    it('counts maxAttempts + Σ attemptsGranted when computing attemptsRemaining/canSubmit', async () => {
      dbMock.lesson.findUnique.mockResolvedValue({ id: 'lesson-1', courseId: 'course-1' })
      dbMock.lessonTest.findMany.mockResolvedValue([
        { id: 'test-1', title: 'Test 1', maxAttempts: 2, passingScore: 70, order: 0, questions: [] },
      ])
      dbMock.lessonTestSubmission.findMany.mockResolvedValue([
        { lessonTestId: 'test-1', attemptNumber: 2, score: 40, isPassed: false, submittedAt: new Date('2026-01-02') },
        { lessonTestId: 'test-1', attemptNumber: 1, score: 30, isPassed: false, submittedAt: new Date('2026-01-01') },
      ])
      dbMock.lessonProgress.findUnique.mockResolvedValue(null)
      dbMock.lessonTestRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: 2 } })

      const result = await getStudentLessonTests('user-1', 'lesson-1')

      expect(result.tests[0]).toMatchObject({
        attemptsUsed: 2,
        attemptsRemaining: 2, // (2 base + 2 granted) - 2 used
        canSubmit: true,
      })
      // D7: prior failed submissions and scores are untouched by a grant.
      expect(result.tests[0].latestSubmission).toMatchObject({ attemptNumber: 2, score: 40 })
    })
  })

  describe('grantLessonTestRevalidation (1.5)', () => {
    const test = { id: 'test-1', lessonId: 'lesson-1', maxAttempts: 1, title: 'Quiz lección 1', lesson: { courseId: 'course-1' } }

    it('rejects unless attempts are exhausted and the latest submission is NOT_PASSED', async () => {
      dbMock.lessonTest.findFirst.mockResolvedValue(test)
      dbMock.lessonTestSubmission.findMany.mockResolvedValue([
        { attemptNumber: 1, isPassed: false, submittedAt: new Date('2026-01-01') },
      ])
      dbMock.lessonTestRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: 1 } }) // not exhausted (allowed=2, used=1)

      await expect(
        grantLessonTestRevalidation('admin-1', 'lesson-1', 'test-1', 'user-1', 1)
      ).rejects.toBeInstanceOf(AcademyAssessmentError)
      expect(dbMock.lessonTestRevalidation.create).not.toHaveBeenCalled()
    })

    it('rejects when the latest submission already passed', async () => {
      dbMock.lessonTest.findFirst.mockResolvedValue(test)
      dbMock.lessonTestSubmission.findMany.mockResolvedValue([
        { attemptNumber: 1, isPassed: true, submittedAt: new Date('2026-01-01') },
      ])

      await expect(
        grantLessonTestRevalidation('admin-1', 'lesson-1', 'test-1', 'user-1', 1)
      ).rejects.toBeInstanceOf(AcademyAssessmentError)
      expect(dbMock.lessonTestRevalidation.create).not.toHaveBeenCalled()
    })

    it('grants a revalidation once attempts are exhausted and the latest submission was not passed', async () => {
      dbMock.lessonTest.findFirst.mockResolvedValue(test)
      dbMock.lessonTestSubmission.findMany.mockResolvedValue([
        { attemptNumber: 1, isPassed: false, submittedAt: new Date('2026-01-01') },
      ])
      dbMock.lessonTestRevalidation.create.mockResolvedValue({ id: 'revalidation-1' })

      const result = await grantLessonTestRevalidation('admin-1', 'lesson-1', 'test-1', 'user-1', 1)

      expect(result).toMatchObject({ id: 'revalidation-1' })
      expect(dbMock.lessonTestRevalidation.create).toHaveBeenCalledTimes(1)
    })

    describe('WS-E grant notification (E.1)', () => {
      it('dispatches academy.attempts.granted exactly once after the create', async () => {
        dbMock.lessonTest.findFirst.mockResolvedValue(test)
        dbMock.lessonTestSubmission.findMany.mockResolvedValue([
          { attemptNumber: 1, isPassed: false, submittedAt: new Date('2026-01-01') },
        ])
        dbMock.lessonTestRevalidation.create.mockResolvedValue({ id: 'revalidation-1' })

        await grantLessonTestRevalidation('admin-1', 'lesson-1', 'test-1', 'user-1', 1)

        expect(dbMock.lessonTestRevalidation.create).toHaveBeenCalledTimes(1)
        expect(notificationMock.attemptsGranted).toHaveBeenCalledTimes(1)
        expect(notificationMock.attemptsGranted).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-1',
            courseId: 'course-1',
            revalidationId: 'revalidation-1',
            attemptsGranted: 1,
          })
        )

        const createOrder = dbMock.lessonTestRevalidation.create.mock.invocationCallOrder[0]
        const dispatchOrder = notificationMock.attemptsGranted.mock.invocationCallOrder[0]
        expect(dispatchOrder).toBeGreaterThan(createOrder)
      })

      it('still resolves the grant when the dispatcher rejects', async () => {
        dbMock.lessonTest.findFirst.mockResolvedValue(test)
        dbMock.lessonTestSubmission.findMany.mockResolvedValue([
          { attemptNumber: 1, isPassed: false, submittedAt: new Date('2026-01-01') },
        ])
        dbMock.lessonTestRevalidation.create.mockResolvedValue({ id: 'revalidation-1' })
        notificationMock.attemptsGranted.mockResolvedValue({ ok: false, error: 'NOTIFICATION_DISPATCH_FAILED' })

        const result = await grantLessonTestRevalidation('admin-1', 'lesson-1', 'test-1', 'user-1', 1)

        expect(result).toMatchObject({ id: 'revalidation-1' })
      })
    })
  })

  describe('grantFinalExamRevalidation (0.2)', () => {
    it('rejects unless attempts are exhausted and the latest attempt is NOT_PASSED', async () => {
      dbMock.finalExam.findUnique.mockResolvedValue({ id: 'exam-1', courseId: 'course-1', maxAttempts: 1 })
      dbMock.finalExamAttempt.findMany.mockResolvedValue([
        { id: 'attempt-1', attemptNumber: 1, status: 'PENDING_REVIEW' },
      ])
      dbMock.finalExamRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: null } })

      await expect(
        grantFinalExamRevalidation('admin-1', 'course-1', 'user-1', 1)
      ).rejects.toBeInstanceOf(AcademyAssessmentError)
      expect(dbMock.finalExamRevalidation.create).not.toHaveBeenCalled()
    })

    it('grants a revalidation once attempts are exhausted and the latest attempt was NOT_PASSED', async () => {
      dbMock.finalExam.findUnique.mockResolvedValue({ id: 'exam-1', courseId: 'course-1', maxAttempts: 1 })
      dbMock.finalExamAttempt.findMany.mockResolvedValue([
        { id: 'attempt-1', attemptNumber: 1, status: 'NOT_PASSED' },
      ])
      dbMock.finalExamRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: null } })
      dbMock.finalExamRevalidation.create.mockResolvedValue({ id: 'revalidation-1' })

      const result = await grantFinalExamRevalidation('admin-1', 'course-1', 'user-1', 1)

      expect(result).toMatchObject({ id: 'revalidation-1' })
      expect(dbMock.finalExamRevalidation.create).toHaveBeenCalledTimes(1)
    })

    describe('WS-E grant notification (E.1)', () => {
      it('dispatches academy.attempts.granted exactly once after the create', async () => {
        dbMock.finalExam.findUnique.mockResolvedValue({ id: 'exam-1', courseId: 'course-1', maxAttempts: 1, title: 'Examen final' })
        dbMock.finalExamAttempt.findMany.mockResolvedValue([
          { id: 'attempt-1', attemptNumber: 1, status: 'NOT_PASSED' },
        ])
        dbMock.finalExamRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: null } })
        dbMock.finalExamRevalidation.create.mockResolvedValue({ id: 'revalidation-1' })

        await grantFinalExamRevalidation('admin-1', 'course-1', 'user-1', 1)

        expect(dbMock.finalExamRevalidation.create).toHaveBeenCalledTimes(1)
        expect(notificationMock.attemptsGranted).toHaveBeenCalledTimes(1)
        expect(notificationMock.attemptsGranted).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-1',
            courseId: 'course-1',
            revalidationId: 'revalidation-1',
            attemptsGranted: 1,
          })
        )

        const createOrder = dbMock.finalExamRevalidation.create.mock.invocationCallOrder[0]
        const dispatchOrder = notificationMock.attemptsGranted.mock.invocationCallOrder[0]
        expect(dispatchOrder).toBeGreaterThan(createOrder)
      })

      it('still resolves the grant when the dispatcher rejects', async () => {
        dbMock.finalExam.findUnique.mockResolvedValue({ id: 'exam-1', courseId: 'course-1', maxAttempts: 1, title: 'Examen final' })
        dbMock.finalExamAttempt.findMany.mockResolvedValue([
          { id: 'attempt-1', attemptNumber: 1, status: 'NOT_PASSED' },
        ])
        dbMock.finalExamRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: null } })
        dbMock.finalExamRevalidation.create.mockResolvedValue({ id: 'revalidation-1' })
        notificationMock.attemptsGranted.mockResolvedValue({ ok: false, error: 'NOTIFICATION_DISPATCH_FAILED' })

        const result = await grantFinalExamRevalidation('admin-1', 'course-1', 'user-1', 1)

        expect(result).toMatchObject({ id: 'revalidation-1' })
      })
    })
  })

  describe('reviewFinalExamAttempt (0.2)', () => {
    beforeEach(() => {
      dbMock.finalExamAttempt.findFirst.mockResolvedValue({
        id: 'attempt-1',
        userId: 'user-1',
        finalExamId: 'exam-1',
        status: 'PENDING_REVIEW',
      })
    })

    it('issues the certificate before updating the attempt status on approval', async () => {
      const callOrder: string[] = []
      ;(generateAndSaveCertificate as Mock).mockImplementation(async () => {
        callOrder.push('issue')
        return { id: 'certificate-1' }
      })
      dbMock.finalExamAttempt.update.mockImplementation(async () => {
        callOrder.push('update')
        return { id: 'attempt-1', status: 'APPROVED' }
      })

      await reviewFinalExamAttempt('reviewer-1', 'course-1', 'attempt-1', 'APPROVED')

      expect(callOrder).toEqual(['issue', 'update'])
    })

    it('keeps the attempt PENDING_REVIEW (no status update) when issuance throws', async () => {
      ;(generateAndSaveCertificate as Mock).mockRejectedValue(new Error('storage down'))

      await expect(
        reviewFinalExamAttempt('reviewer-1', 'course-1', 'attempt-1', 'APPROVED')
      ).rejects.toMatchObject({ code: 'CERTIFICATE_ISSUE_FAILED' })
      expect(dbMock.finalExamAttempt.update).not.toHaveBeenCalled()
    })
  })
})
