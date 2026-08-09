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
  authorizeCourseAccessByModuleId: jest.fn(),
  toAccessDeniedResponse: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    moduleTest: { findMany: jest.fn() },
    moduleSubmission: { findMany: jest.fn() },
    moduleProgress: { upsert: jest.fn(), count: jest.fn() },
    module: { count: jest.fn() },
    courseTest: { count: jest.fn() },
    courseExam: { count: jest.fn() },
    certificate: { findFirst: jest.fn(), create: jest.fn() },
  },
}))

jest.mock('@/server/services/notification-service', () => ({
  NotificationService: {
    triggerOnCourseCompletion: jest.fn(),
  },
}))

import { authorizeCourseAccessByModuleId } from '@/lib/course-access-control'
import { db } from '@/lib/db'
import { NotificationService } from '@/server/services/notification-service'
import { POST } from '@/app/api/modules/[moduleId]/progress/route'

const mockedAuthorize = authorizeCourseAccessByModuleId as jest.Mock
const mockedDb = db as unknown as {
  moduleTest: { findMany: jest.Mock }
  moduleProgress: { upsert: jest.Mock; count: jest.Mock }
  module: { count: jest.Mock }
}
const mockedNotifications = NotificationService as unknown as {
  triggerOnCourseCompletion: jest.Mock
}

describe('module progress notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedAuthorize.mockResolvedValue({
      ok: true,
      user: { id: 'student-1' },
      courseId: 'course-1',
    })
    mockedDb.moduleTest.findMany.mockResolvedValue([])
    mockedDb.moduleProgress.upsert.mockResolvedValue({
      userId: 'student-1',
      moduleId: 'module-1',
      completed: true,
    })
    mockedDb.module.count.mockResolvedValue(2)
    mockedDb.moduleProgress.count.mockResolvedValue(1)
  })

  it('does not announce course completion for a module; final approval/certification owns that event', async () => {
    const request = new Request('http://localhost/api/modules/module-1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })

    const response = await POST(request, {
      params: Promise.resolve({ moduleId: 'module-1' }),
    })

    expect(response.status).toBe(200)
    expect(mockedNotifications.triggerOnCourseCompletion).not.toHaveBeenCalled()
  })
})
