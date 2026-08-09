import { NotificationDeliveryChannel, NotificationPriority } from '@prisma/client'

jest.mock('@/lib/db', () => ({
  db: {
    course: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
  },
}))

import { db } from '@/lib/db'
import { NotificationService } from '@/server/services/notification-service'

const mockedDb = db as unknown as {
  course: { findUnique: jest.Mock }
  user: { findMany: jest.Mock }
}

describe('assessment submission notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedDb.course.findUnique.mockResolvedValue({ title: 'Rizos definidos' })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('dispatches a student acknowledgement and alerts every admin when review is required', async () => {
    mockedDb.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }])
    const dispatch = jest.spyOn(NotificationService, 'dispatch').mockResolvedValue({
      ok: true,
      notifications: 1,
      deliveries: 1,
    })

    await NotificationService.triggerOnAssessmentSubmission({
      userId: 'student-1',
      courseId: 'course-1',
      submissionId: 'submission-1',
      assessmentType: 'FINAL_EXAM',
      requiresReview: true,
    })

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      eventKey: 'academy.submission.received',
      type: 'SUBMISSION',
      title: 'Entrega recibida',
      message: 'Tu examen final de "Rizos definidos" fue recibido y está pendiente de revisión.',
      recipients: [{ userId: 'student-1' }],
      channels: [NotificationDeliveryChannel.IN_APP],
      resource: { type: 'ASSESSMENT_SUBMISSION', id: 'submission-1' },
      actionUrl: '/learn/course-1',
      priority: NotificationPriority.NORMAL,
      dedupeKey: 'academy-submission:submission-1:initial:received',
    })
    expect(mockedDb.user.findMany).toHaveBeenCalledWith({
      where: { role: 'ADMIN' },
      select: { id: true },
    })
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      eventKey: 'academy.submission.pending_review',
      type: 'SUBMISSION',
      title: 'Nueva entrega pendiente de revisión',
      message: 'Se recibió un examen final de "Rizos definidos" para revisión.',
      recipients: [{ userId: 'admin-1' }, { userId: 'admin-2' }],
      channels: [NotificationDeliveryChannel.IN_APP],
      resource: { type: 'ASSESSMENT_SUBMISSION', id: 'submission-1' },
      actionUrl: '/admin/courses/review',
      priority: NotificationPriority.HIGH,
      dedupeKey: 'academy-submission:submission-1:initial:pending-review',
    })
  })

  it('does not alert admins for an automatically graded course test', async () => {
    const dispatch = jest.spyOn(NotificationService, 'dispatch').mockResolvedValue({
      ok: true,
      notifications: 1,
      deliveries: 1,
    })

    await NotificationService.triggerOnAssessmentSubmission({
      userId: 'student-1',
      courseId: 'course-1',
      submissionId: 'submission-1',
      assessmentType: 'COURSE_TEST',
      requiresReview: false,
    })

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'academy.submission.received',
        type: 'SUBMISSION',
        recipients: [{ userId: 'student-1' }],
        resource: { type: 'ASSESSMENT_SUBMISSION', id: 'submission-1' },
      })
    )
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: 'academy.submission.pending_review' })
    )
    expect(mockedDb.user.findMany).not.toHaveBeenCalled()
  })
})
