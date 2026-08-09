jest.mock('next/server', () => ({
  NextRequest: class NextRequest extends Request {},
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}))

jest.mock('@/lib/course-access-control', () => ({
  authorizeCourseAccessByCourseId: jest.fn(),
  toAccessDeniedResponse: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    courseTest: { findUnique: jest.fn() },
    courseTestSubmission: { count: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/server/services/notification-service', () => ({
  NotificationService: {
    triggerOnAssessmentSubmission: jest.fn(),
  },
}))

import { authorizeCourseAccessByCourseId } from '@/lib/course-access-control'
import { db } from '@/lib/db'
import { NotificationService } from '@/server/services/notification-service'
import { POST } from '@/app/api/student/courses/[courseId]/tests/[testId]/submit/route'

const mockedAuthorize = authorizeCourseAccessByCourseId as jest.Mock
const mockedDb = db as unknown as {
  courseTest: { findUnique: jest.Mock }
  courseTestSubmission: { count: jest.Mock }
  $transaction: jest.Mock
}
const mockedNotifications = NotificationService as unknown as {
  triggerOnAssessmentSubmission: jest.Mock
}

function submissionRequest(answers: Record<string, string>) {
  return new Request('http://localhost/api/student/courses/course-1/tests/test-1/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  })
}

describe('student course-test submission notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedAuthorize.mockResolvedValue({
      ok: true,
      user: { id: 'student-1' },
      courseId: 'course-1',
    })
    mockedDb.courseTestSubmission.count.mockResolvedValue(0)
    mockedNotifications.triggerOnAssessmentSubmission.mockResolvedValue(undefined)
    mockedDb.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        courseTestSubmission: {
          create: jest.fn().mockResolvedValue({
            id: 'submission-1',
            isPassed: false,
            attemptNumber: 1,
            status: 'PENDING',
          }),
        },
        questionSubmission: { create: jest.fn().mockResolvedValue({ id: 'answer-1' }) },
      })
    )
  })

  it('notifies admins and acknowledges the student for a final course test', async () => {
    mockedDb.courseTest.findUnique.mockResolvedValue({
      id: 'test-1',
      courseId: 'course-1',
      isFinalExam: true,
      maxAttempts: 2,
      passingScore: 70,
      questions: [],
    })

    const response = await POST(submissionRequest({}), {
      params: Promise.resolve({ courseId: 'course-1', testId: 'test-1' }),
    })

    expect(response.status).toBe(200)
    expect(mockedNotifications.triggerOnAssessmentSubmission).toHaveBeenCalledWith({
      userId: 'student-1',
      courseId: 'course-1',
      submissionId: 'submission-1',
      assessmentType: 'FINAL_EXAM',
      requiresReview: true,
    })
  })

  it('notifies admins and acknowledges the student for a manually reviewed course test', async () => {
    mockedDb.courseTest.findUnique.mockResolvedValue({
      id: 'test-1',
      courseId: 'course-1',
      isFinalExam: false,
      maxAttempts: 2,
      passingScore: 70,
      questions: [
        {
          id: 'question-1',
          type: 'WRITTEN',
          config: {},
        },
      ],
    })

    const response = await POST(submissionRequest({ 'question-1': 'Mi respuesta' }), {
      params: Promise.resolve({ courseId: 'course-1', testId: 'test-1' }),
    })

    expect(response.status).toBe(200)
    expect(mockedNotifications.triggerOnAssessmentSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentType: 'COURSE_TEST',
        requiresReview: true,
      })
    )
  })

  it('acknowledges an automatically graded test without creating an admin review alert', async () => {
    mockedDb.courseTest.findUnique.mockResolvedValue({
      id: 'test-1',
      courseId: 'course-1',
      isFinalExam: false,
      maxAttempts: 2,
      passingScore: 70,
      questions: [
        {
          id: 'question-1',
          type: 'MULTIPLE_CHOICE',
          config: { correctAnswer: 'A' },
        },
      ],
    })

    const response = await POST(submissionRequest({ 'question-1': 'A' }), {
      params: Promise.resolve({ courseId: 'course-1', testId: 'test-1' }),
    })

    expect(response.status).toBe(200)
    expect(mockedNotifications.triggerOnAssessmentSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentType: 'COURSE_TEST',
        requiresReview: false,
      })
    )
  })
})
