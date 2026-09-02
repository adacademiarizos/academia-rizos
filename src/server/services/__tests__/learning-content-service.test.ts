import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { AssessmentQuestionType } from '@prisma/client'
import { db } from '@/lib/db'
import {
  calculateMultipleChoiceScore,
  requiresManualReview,
  grantAssessmentRevalidation,
  LearningContentError,
} from '../learning-content-service'

vi.mock('@/lib/db', () => ({
  db: {
    assessment: {
      findUnique: vi.fn(),
    },
    assessmentAttempt: {
      findMany: vi.fn(),
    },
    assessmentRevalidation: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/server/services/notification-event-service', () => ({
  NotificationEventService: {
    attemptsGranted: vi.fn(),
  },
}))

import { NotificationEventService } from '@/server/services/notification-event-service'

const dbMock = db as unknown as {
  assessment: { findUnique: Mock }
  assessmentAttempt: { findMany: Mock }
  assessmentRevalidation: { aggregate: Mock; create: Mock }
}

const notificationMock = NotificationEventService as unknown as {
  attemptsGranted: Mock
}

describe('learning-content-service.grantAssessmentRevalidation (0.4, characterization)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notificationMock.attemptsGranted.mockResolvedValue(undefined)
  })

  it('rejects when attempts used are fewer than maxAttempts + Σ prior grants', async () => {
    dbMock.assessment.findUnique.mockResolvedValue({ id: 'assessment-1', maxAttempts: 3 })
    dbMock.assessmentAttempt.findMany.mockResolvedValue([{ status: 'NOT_PASSED' }, { status: 'NOT_PASSED' }])
    dbMock.assessmentRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: null } })

    await expect(
      grantAssessmentRevalidation('admin-1', 'assessment-1', 'user-1', { attemptsGranted: 1 })
    ).rejects.toBeInstanceOf(LearningContentError)
    expect(dbMock.assessmentRevalidation.create).not.toHaveBeenCalled()
  })

  it('rejects when the latest attempt is not NOT_PASSED', async () => {
    dbMock.assessment.findUnique.mockResolvedValue({ id: 'assessment-1', maxAttempts: 1 })
    dbMock.assessmentAttempt.findMany.mockResolvedValue([{ status: 'APPROVED' }])
    dbMock.assessmentRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: null } })

    await expect(
      grantAssessmentRevalidation('admin-1', 'assessment-1', 'user-1', { attemptsGranted: 1 })
    ).rejects.toBeInstanceOf(LearningContentError)
    expect(dbMock.assessmentRevalidation.create).not.toHaveBeenCalled()
  })

  it('rejects when attemptsGranted < 1', async () => {
    await expect(
      grantAssessmentRevalidation('admin-1', 'assessment-1', 'user-1', { attemptsGranted: 0 })
    ).rejects.toBeInstanceOf(LearningContentError)
    expect(dbMock.assessment.findUnique).not.toHaveBeenCalled()
  })

  describe('WS-E grant notification (E.1)', () => {
    it('dispatches academy.attempts.granted exactly once after the create, outside its transaction', async () => {
      dbMock.assessment.findUnique.mockResolvedValue({
        id: 'assessment-1',
        maxAttempts: 1,
        title: 'Evaluación módulo 1',
        courseId: 'course-1',
      })
      dbMock.assessmentAttempt.findMany.mockResolvedValue([{ status: 'NOT_PASSED' }])
      dbMock.assessmentRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: null } })
      dbMock.assessmentRevalidation.create.mockResolvedValue({ id: 'revalidation-1' })

      await grantAssessmentRevalidation('admin-1', 'assessment-1', 'user-1', { attemptsGranted: 1 })

      expect(dbMock.assessmentRevalidation.create).toHaveBeenCalledTimes(1)
      expect(notificationMock.attemptsGranted).toHaveBeenCalledTimes(1)
      expect(notificationMock.attemptsGranted).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          courseId: 'course-1',
          revalidationId: 'revalidation-1',
          attemptsGranted: 1,
        })
      )

      // Called after the create, and never wrapped in the same call as create
      // (this service performs no $transaction — dispatch is a separate,
      // subsequent async call, not part of a DB transaction).
      const createOrder = dbMock.assessmentRevalidation.create.mock.invocationCallOrder[0]
      const dispatchOrder = notificationMock.attemptsGranted.mock.invocationCallOrder[0]
      expect(dispatchOrder).toBeGreaterThan(createOrder)
    })

    it('still resolves the grant and keeps the revalidation row when the dispatcher rejects', async () => {
      dbMock.assessment.findUnique.mockResolvedValue({
        id: 'assessment-1',
        maxAttempts: 1,
        title: 'Evaluación módulo 1',
        courseId: 'course-1',
      })
      dbMock.assessmentAttempt.findMany.mockResolvedValue([{ status: 'NOT_PASSED' }])
      dbMock.assessmentRevalidation.aggregate.mockResolvedValue({ _sum: { attemptsGranted: null } })
      dbMock.assessmentRevalidation.create.mockResolvedValue({ id: 'revalidation-1' })
      notificationMock.attemptsGranted.mockResolvedValue({ ok: false, error: 'NOTIFICATION_DISPATCH_FAILED' })

      const result = await grantAssessmentRevalidation('admin-1', 'assessment-1', 'user-1', { attemptsGranted: 1 })

      expect(result).toMatchObject({ id: 'revalidation-1' })
      expect(dbMock.assessmentRevalidation.create).toHaveBeenCalledTimes(1)
    })
  })
})

describe('learning-content assessment rules', () => {
  it('grades all-multiple-choice assessments automatically', () => {
    const answers = new Map([
      ['one', { questionId: 'one', responseText: 'A' }],
      ['two', { questionId: 'two', responseText: 'wrong' }],
    ])
    expect(calculateMultipleChoiceScore([
      { id: 'one', correctAnswer: 'A' },
      { id: 'two', correctAnswer: 'B' },
    ], answers)).toBe(50)
    expect(requiresManualReview([AssessmentQuestionType.MULTIPLE_CHOICE])).toBe(false)
  })

  it.each([AssessmentQuestionType.WRITTEN, AssessmentQuestionType.PHOTO, AssessmentQuestionType.VIDEO])(
    'routes %s evidence to administrative review',
    (type) => {
      expect(requiresManualReview([AssessmentQuestionType.MULTIPLE_CHOICE, type])).toBe(true)
    }
  )
})
