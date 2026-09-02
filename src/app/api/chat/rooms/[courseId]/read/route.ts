/**
 * POST /api/chat/rooms/[courseId]/read
 * Mark this course's chat as read up to now for the caller. Access is checked
 * exactly like the room endpoint: admins always pass, students need an active
 * CourseAccess record.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { isCourseAccessActive } from '@/lib/course-access'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Debes iniciar sesión' }, { status: 401 })
    }

    const { courseId } = await params
    if (!courseId) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      const access = await db.courseAccess.findUnique({
        where: { userId_courseId: { userId: user.id, courseId } },
        select: { accessUntil: true, revokedAt: true },
      })

      if (!isCourseAccessActive(access)) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a este curso' },
          { status: 403 }
        )
      }
    }

    const room = await db.chatRoom.findUnique({
      where: { courseId },
      select: { id: true },
    })

    // The room is created lazily on first visit; with no room there is nothing
    // unread to clear, so this is a no-op rather than an error.
    if (!room) {
      return NextResponse.json({ success: true, data: { lastReadAt: null } })
    }

    const lastReadAt = new Date()
    await db.chatRoomRead.upsert({
      where: { userId_roomId: { userId: user.id, roomId: room.id } },
      create: { userId: user.id, roomId: room.id, lastReadAt },
      update: { lastReadAt },
    })

    return NextResponse.json({ success: true, data: { lastReadAt: lastReadAt.toISOString() } })
  } catch (error) {
    console.error('Error marking chat room as read:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to mark the chat as read' },
      { status: 500 }
    )
  }
}
