/**
 * GET /api/chat/messages - List messages for a room (requires auth)
 * POST /api/chat/messages - Create a new chat message (requires enrollment)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { CommunityService } from '@/server/services/community-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
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
    const session = await getServerSession()
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

    // Verify the user has access to the room's course (admins bypass)
    if (user.role !== 'ADMIN') {
      const room = await db.chatRoom.findUnique({
        where: { id: roomId },
        select: { courseId: true, type: true },
      })

      if (!room) {
        return NextResponse.json({ success: false, error: 'Sala no encontrada' }, { status: 404 })
      }

      // COURSE rooms require enrollment; COMMUNITY rooms just require auth
      if (room.type === 'COURSE' && room.courseId) {
        const access = await db.courseAccess.findUnique({
          where: { userId_courseId: { userId: user.id, courseId: room.courseId } },
          select: { accessUntil: true },
        })

        const hasAccess = access && (access.accessUntil === null || access.accessUntil > new Date())

        if (!hasAccess) {
          return NextResponse.json(
            { success: false, error: 'No tienes acceso a este chat' },
            { status: 403 }
          )
        }
      }
    }

    const message = await CommunityService.createChatMessage(
      user.id,
      roomId,
      messageBody || '',
      imageUrl || undefined
    )

    return NextResponse.json({ success: true, data: message })
  } catch (error) {
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
