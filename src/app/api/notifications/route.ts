/**
 * GET /api/notifications - Fetch user's notifications
 * POST /api/notifications/[id]/read - Mark notification as read
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { NotificationService } from '@/server/services/notification-service'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const isRead = searchParams.get('isRead')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch notifications
    const result = await NotificationService.getNotifications(user.id, {
      isRead: isRead === null ? undefined : isRead === 'true',
      limit,
      offset,
    })

    return NextResponse.json({
      success: true,
      data: result.notifications,
      unreadCount: result.unreadCount,
      total: result.total,
      count: result.notifications.length,
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch notifications',
      },
      { status: 500 }
    )
  }
}
