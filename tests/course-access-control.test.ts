jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth-options', () => ({
  authOptions: {},
}))

jest.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: jest.fn() },
    course: { findUnique: jest.fn() },
    module: { findUnique: jest.fn() },
    courseAccess: { findUnique: jest.fn() },
    chatRoom: { findUnique: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import {
  authorizeChatRoomAccessByRoomId,
  authorizeCourseAccessByCourseId,
  authorizeCourseAccessByModuleId,
} from '@/lib/course-access-control'
import { db } from '@/lib/db'

const mockedGetServerSession = getServerSession as jest.Mock
const mockedDb = db as unknown as {
  user: { findUnique: jest.Mock }
  course: { findUnique: jest.Mock }
  module: { findUnique: jest.Mock }
  courseAccess: { findUnique: jest.Mock }
  chatRoom: { findUnique: jest.Mock }
}

describe('course-access-control', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns SIGN_IN_REQUIRED when there is no session', async () => {
    mockedGetServerSession.mockResolvedValue(null)

    const result = await authorizeCourseAccessByCourseId('course_1')

    expect(result).toMatchObject({
      ok: false,
      code: 'SIGN_IN_REQUIRED',
      status: 401,
    })
  })

  it('returns USER_NOT_FOUND when session user is missing in database', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { email: 'student@example.com' } })
    mockedDb.user.findUnique.mockResolvedValue(null)

    const result = await authorizeCourseAccessByCourseId('course_1')

    expect(result).toMatchObject({
      ok: false,
      code: 'USER_NOT_FOUND',
      status: 404,
    })
  })

  it('allows admin bypass when configured for course access', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { email: 'admin@example.com' } })
    mockedDb.user.findUnique.mockResolvedValue({
      id: 'user_admin',
      email: 'admin@example.com',
      role: 'ADMIN',
    })
    mockedDb.course.findUnique.mockResolvedValue({ id: 'course_1' })

    const result = await authorizeCourseAccessByCourseId('course_1', { allowAdmin: true })

    expect(result).toMatchObject({
      ok: true,
      courseId: 'course_1',
      viaAdmin: true,
    })
  })

  it('returns COURSE_PURCHASE_REQUIRED when user has not bought the course', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { email: 'student@example.com' } })
    mockedDb.user.findUnique.mockResolvedValue({
      id: 'user_student',
      email: 'student@example.com',
      role: 'STUDENT',
    })
    mockedDb.course.findUnique.mockResolvedValue({ id: 'course_1' })
    mockedDb.courseAccess.findUnique.mockResolvedValue(null)

    const result = await authorizeCourseAccessByCourseId('course_1')

    expect(result).toMatchObject({
      ok: false,
      code: 'COURSE_PURCHASE_REQUIRED',
      status: 403,
    })
  })

  it('returns COURSE_ACCESS_EXPIRED when access is expired and active access is required', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { email: 'student@example.com' } })
    mockedDb.user.findUnique.mockResolvedValue({
      id: 'user_student',
      email: 'student@example.com',
      role: 'STUDENT',
    })
    mockedDb.course.findUnique.mockResolvedValue({ id: 'course_1' })
    mockedDb.courseAccess.findUnique.mockResolvedValue({
      accessUntil: new Date('2025-01-01T00:00:00.000Z'),
    })

    const result = await authorizeCourseAccessByCourseId('course_1', {
      requireActiveAccess: true,
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'COURSE_ACCESS_EXPIRED',
      status: 403,
    })
  })

  it('allows active course access for a student', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { email: 'student@example.com' } })
    mockedDb.user.findUnique.mockResolvedValue({
      id: 'user_student',
      email: 'student@example.com',
      role: 'STUDENT',
    })
    mockedDb.course.findUnique.mockResolvedValue({ id: 'course_1' })
    mockedDb.courseAccess.findUnique.mockResolvedValue({
      accessUntil: new Date('2099-01-01T00:00:00.000Z'),
    })

    const result = await authorizeCourseAccessByCourseId('course_1')

    expect(result).toMatchObject({
      ok: true,
      courseId: 'course_1',
      viaAdmin: false,
    })
  })

  it('returns MODULE_NOT_FOUND when module does not exist', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { email: 'student@example.com' } })
    mockedDb.user.findUnique.mockResolvedValue({
      id: 'user_student',
      email: 'student@example.com',
      role: 'STUDENT',
    })
    mockedDb.module.findUnique.mockResolvedValue(null)

    const result = await authorizeCourseAccessByModuleId('module_1')

    expect(result).toMatchObject({
      ok: false,
      code: 'MODULE_NOT_FOUND',
      status: 404,
    })
  })

  it('allows access to community chat rooms for authenticated users', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { email: 'student@example.com' } })
    mockedDb.user.findUnique.mockResolvedValue({
      id: 'user_student',
      email: 'student@example.com',
      role: 'STUDENT',
    })
    mockedDb.chatRoom.findUnique.mockResolvedValue({
      id: 'room_1',
      courseId: null,
      type: 'COMMUNITY',
    })

    const result = await authorizeChatRoomAccessByRoomId('room_1')

    expect(result).toMatchObject({
      ok: true,
      room: {
        id: 'room_1',
        type: 'COMMUNITY',
      },
    })
  })
})
