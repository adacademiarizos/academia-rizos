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

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth-options', () => ({
  authOptions: {},
}))

jest.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: jest.fn() },
    courseExam: { findUnique: jest.fn() },
    courseAccess: { findUnique: jest.fn() },
    examSubmission: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('@/server/services/notification-service', () => ({
  NotificationService: {
    triggerOnAssessmentSubmission: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { NotificationService } from '@/server/services/notification-service'
import { POST } from '@/app/api/student/courses/[courseId]/exam/submit/route'

const mockedSession = getServerSession as jest.Mock
const mockedDb = db as unknown as {
  user: { findUnique: jest.Mock }
  courseExam: { findUnique: jest.Mock }
  courseAccess: { findUnique: jest.Mock }
  examSubmission: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock }
}
const mockedNotifications = NotificationService as unknown as {
  triggerOnAssessmentSubmission: jest.Mock
}

describe('student final-exam submission notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedSession.mockResolvedValue({ user: { email: 'student@example.com' } })
    mockedDb.user.findUnique.mockResolvedValue({ id: 'student-1' })
    mockedDb.courseExam.findUnique.mockResolvedValue({
      id: 'exam-1',
      passingScore: 70,
      questions: [],
      course: { id: 'course-1', title: 'Rizos definidos' },
    })
    mockedDb.courseAccess.findUnique.mockResolvedValue({ revokedAt: null })
    mockedDb.examSubmission.findUnique.mockResolvedValue(null)
    mockedDb.examSubmission.create.mockResolvedValue({ id: 'submission-1' })
    mockedNotifications.triggerOnAssessmentSubmission.mockResolvedValue(undefined)
  })

  it('notifies all admins and persists an acknowledgement after a final-exam submission', async () => {
    const request = new Request('http://localhost/api/student/courses/course-1/exam/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: {} }),
    })

    const response = await POST(request, {
      params: Promise.resolve({ courseId: 'course-1' }),
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
})
