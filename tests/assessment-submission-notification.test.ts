jest.mock('@/lib/db', () => ({
  db: {
    notification: { create: jest.fn() },
    course: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
  },
}))

import { db } from '@/lib/db'
import { NotificationService } from '@/server/services/notification-service'

const mockedDb = db as unknown as {
  notification: { create: jest.Mock }
  course: { findUnique: jest.Mock }
}

describe('assessment submission notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedDb.course.findUnique.mockResolvedValue({ title: 'Rizos definidos' })
    mockedDb.notification.create.mockResolvedValue({ id: 'notification-1' })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('persists a student acknowledgement and alerts all admins when review is required', async () => {
    const notifyAllAdmins = jest
      .spyOn(NotificationService, 'notifyAllAdmins')
      .mockResolvedValue(undefined)

    await NotificationService.triggerOnAssessmentSubmission({
      userId: 'student-1',
      courseId: 'course-1',
      submissionId: 'submission-1',
      assessmentType: 'FINAL_EXAM',
      requiresReview: true,
    })

    expect(mockedDb.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'student-1',
        type: 'SUBMISSION',
        title: 'Entrega recibida',
        message: 'Tu examen final de "Rizos definidos" fue recibido y está pendiente de revisión.',
        relatedId: 'submission-1',
      },
    })
    expect(notifyAllAdmins).toHaveBeenCalledWith({
      type: 'SUBMISSION',
      title: 'Nueva entrega pendiente de revisión',
      message: 'Se recibió un examen final de "Rizos definidos" para revisión.',
      relatedId: 'submission-1',
    })
  })

  it('does not alert admins for an automatically graded course test', async () => {
    const notifyAllAdmins = jest
      .spyOn(NotificationService, 'notifyAllAdmins')
      .mockResolvedValue(undefined)

    await NotificationService.triggerOnAssessmentSubmission({
      userId: 'student-1',
      courseId: 'course-1',
      submissionId: 'submission-1',
      assessmentType: 'COURSE_TEST',
      requiresReview: false,
    })

    expect(mockedDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'student-1',
        type: 'SUBMISSION',
        relatedId: 'submission-1',
      }),
    })
    expect(notifyAllAdmins).not.toHaveBeenCalled()
  })
})
