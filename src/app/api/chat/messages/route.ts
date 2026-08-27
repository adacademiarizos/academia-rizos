/**
 * GET /api/chat/messages - List messages for a room
 * POST /api/chat/messages - Create a new chat message
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeChatRoomAccessByRoomId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { CommunityService } from '@/server/services/community-service'
import {
  CommunityInteractionValidationError,
  CommunityNotificationService,
} from '@/server/services/community-notification-service'

export async function GET(request: NextRequest) {
  try {
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

    const access = await authorizeChatRoomAccessByRoomId(roomId, {
      allowAdmin: true,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
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

    const access = await authorizeChatRoomAccessByRoomId(roomId, {
      allowAdmin: true,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    // Mention ids are embedded in visible canonical tokens. The service only
    // accepts people who already participated in this same authorized room.
    const mentionRecipientIds = await CommunityNotificationService.resolveChatMentionRecipientIds({
      authorId: access.user.id,
      room: access.room,
      body: messageBody || '',
    })

    const message = await CommunityService.createChatMessage(
      access.user.id,
      roomId,
      messageBody || '',
      imageUrl || undefined
    )

    await CommunityNotificationService.dispatchChatMentions({
      actor: message.user,
      message,
      room: access.room,
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
