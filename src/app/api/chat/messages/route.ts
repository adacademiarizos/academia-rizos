/**
 * GET /api/chat/messages - List messages for a room (requires auth)
 * POST /api/chat/messages - Create a new chat message (requires enrollment)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { isCourseAccessActive } from '@/lib/course-access'
import { CommunityService } from '@/server/services/community-service'
import {
  CommunityInteractionValidationError,
  CommunityNotificationService,
} from '@/server/services/community-notification-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Debes iniciar sesión para ver los mensajes' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const limitParam = searchParams.get('limit') || '50'
    const offsetParam = searchParams.get('offset') || '0'

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'roomId query parameter is required' },
        { status: 400 }
      )
    }

    const limit = Math.min(Math.max(parseInt(limitParam), 1), 100)
    const offset = Math.max(parseInt(offsetParam), 0)

    const result = await CommunityService.getChatMessages(roomId, limit, offset)

    return NextResponse.json({
      success: true,
      data: result,
      count: result.messages.length,
    })
  } catch (error) {
    console.error('Error fetching chat messages:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { roomId, body: messageBody, imageUrl } = body

    if (!roomId) {
      return NextResponse.json({ success: false, error: 'roomId is required' }, { status: 400 })
    }

    if (!messageBody?.trim() && !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'El mensaje debe tener texto o una imagen' },
        { status: 400 }
      )
    }

    if (messageBody && messageBody.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'El mensaje no puede superar 1000 caracteres' },
        { status: 400 }
      )
    }

    // The room is needed by the access check and by the mention dispatch below,
    // so it is resolved before the admin bypass rather than inside it.
    const room = await db.chatRoom.findUnique({
      where: { id: roomId },
      select: { id: true, courseId: true, type: true },
    })

    if (!room) {
      return NextResponse.json({ success: false, error: 'Sala no encontrada' }, { status: 404 })
    }

    // Verify the user has access to the room's course (admins bypass).
    // COURSE rooms require enrollment; COMMUNITY rooms just require auth.
    if (user.role !== 'ADMIN' && room.type === 'COURSE' && room.courseId) {
      const access = await db.courseAccess.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: room.courseId } },
        select: { accessUntil: true, revokedAt: true },
      })

      if (!isCourseAccessActive(access)) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a este chat' },
          { status: 403 }
        )
      }
    }

    // Mention ids are embedded in visible canonical tokens. The service only
    // accepts people who already participated in this same authorized room.
    const mentionRecipientIds = await CommunityNotificationService.resolveChatMentionRecipientIds({
      authorId: user.id,
      room,
      body: messageBody || '',
    })

    const message = await CommunityService.createChatMessage(
      user.id,
      roomId,
      messageBody || '',
      imageUrl || undefined
    )

    await CommunityNotificationService.dispatchChatMentions({
      actor: message.user,
      message,
      room,
      recipientIds: mentionRecipientIds,
    }).catch((error) => {
      // Message persistence is already complete. A notification failure must
      // never make a valid chat message fail.
      console.error('Error dispatching chat mention notifications:', error)
    })

    return NextResponse.json({ success: true, data: message })
  } catch (error) {
    if (error instanceof CommunityInteractionValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    console.error('Error creating chat message:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create message',
      },
      { status: 500 }
    )
  }
}
