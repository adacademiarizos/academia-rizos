/**
 * GET /api/chat/rooms/[courseId]
 * Get or create chat room for a course — requires enrollment
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { CommunityService } from '@/server/services/community-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Debes iniciar sesión para acceder al chat' },
        { status: 401 }
      )
    }

    const { courseId } = await params

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Admins always have access; students need a valid CourseAccess record
    if (user.role !== 'ADMIN') {
      const access = await db.courseAccess.findUnique({
        where: { userId_courseId: { userId: user.id, courseId } },
        select: { accessUntil: true },
      })

      const hasAccess = access && (access.accessUntil === null || access.accessUntil > new Date())

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a este curso' },
          { status: 403 }
        )
      }
    }

    const room = await CommunityService.getOrCreateChatRoom(courseId)

    return NextResponse.json({ success: true, data: room })
  } catch (error) {
    console.error('Error getting chat room:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat room',
      },
      { status: 500 }
    )
  }
}
