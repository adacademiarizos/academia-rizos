/**
 * GET /api/student/my-courses
 * List the caller's accessible courses for the chat sidebar, newest
 * conversation first with an unread count per room — the ordering a chat list
 * is expected to have. Admins see all published courses (mirrors the admin
 * bypass in api/chat/rooms/[courseId]/route.ts:45-59); students see only
 * courses with an active CourseAccess record. Never accepts a userId param —
 * the caller is always resolved from the session, never from the request.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { buildActiveCourseAccessWhere } from '@/lib/course-access'

type CourseSummary = { id: string; title: string }

/**
 * Decorates courses with their chat activity. A course with no room or no
 * messages yet keeps a null lastMessageAt and sorts below active ones,
 * alphabetically among its peers.
 */
async function withChatActivity(userId: string, courses: CourseSummary[]) {
  if (courses.length === 0) return []

  const courseIds = courses.map((course) => course.id)
  const rooms = await db.chatRoom.findMany({
    where: { courseId: { in: courseIds } },
    select: { id: true, courseId: true },
  })

  if (rooms.length === 0) {
    return courses
      .map((course) => ({ ...course, lastMessageAt: null, unreadCount: 0 }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  const roomIds = rooms.map((room) => room.id)
  const [reads, lastMessages] = await Promise.all([
    db.chatRoomRead.findMany({
      where: { userId, roomId: { in: roomIds } },
      select: { roomId: true, lastReadAt: true },
    }),
    db.chatMessage.groupBy({
      by: ['roomId'],
      where: { roomId: { in: roomIds } },
      _max: { createdAt: true },
    }),
  ])

  const lastReadByRoom = new Map(reads.map((read) => [read.roomId, read.lastReadAt]))

  // One grouped query for every room, each with its own read cutoff. A room the
  // user has never opened has no cutoff, so everything in it is unread.
  const unreadGroups = await db.chatMessage.groupBy({
    by: ['roomId'],
    where: {
      userId: { not: userId },
      OR: roomIds.map((roomId) => {
        const lastReadAt = lastReadByRoom.get(roomId)
        return lastReadAt ? { roomId, createdAt: { gt: lastReadAt } } : { roomId }
      }),
    },
    _count: { _all: true },
  })

  const unreadByRoom = new Map(unreadGroups.map((group) => [group.roomId, group._count._all]))
  const lastMessageByRoom = new Map(
    lastMessages.map((group) => [group.roomId, group._max.createdAt])
  )
  const roomByCourse = new Map(
    rooms
      .filter((room): room is { id: string; courseId: string } => room.courseId !== null)
      .map((room) => [room.courseId, room.id])
  )

  return courses
    .map((course) => {
      const roomId = roomByCourse.get(course.id)
      const lastMessageAt = roomId ? lastMessageByRoom.get(roomId) ?? null : null
      return {
        ...course,
        lastMessageAt: lastMessageAt ? lastMessageAt.toISOString() : null,
        unreadCount: roomId ? unreadByRoom.get(roomId) ?? 0 : 0,
      }
    })
    .sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) {
        return b.lastMessageAt.localeCompare(a.lastMessageAt)
      }
      if (a.lastMessageAt) return -1
      if (b.lastMessageAt) return 1
      return a.title.localeCompare(b.title)
    })
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Debes iniciar sesión' },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.role === 'ADMIN') {
      const courses = await db.course.findMany({
        where: { isActive: true },
        select: { id: true, title: true },
      })
      return NextResponse.json({ success: true, data: await withChatActivity(user.id, courses) })
    }

    const accesses = await db.courseAccess.findMany({
      where: { userId: user.id, ...buildActiveCourseAccessWhere() },
      select: { course: { select: { id: true, title: true } } },
    })

    const courses = accesses.map((access) => access.course)

    return NextResponse.json({ success: true, data: await withChatActivity(user.id, courses) })
  } catch (error) {
    console.error('Error listing student courses:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list courses' },
      { status: 500 }
    )
  }
}
