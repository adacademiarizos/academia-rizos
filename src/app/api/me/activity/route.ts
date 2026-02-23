/**
 * GET /api/me/activity
 * Get current user's activity feed
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { AnalyticsService } from '@/server/services/analytics-service'

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
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get activity feed
    const result = await AnalyticsService.getActivityFeed(user.id, limit, offset)

    return NextResponse.json({
      success: true,
      data: result.activities,
      total: result.total,
      count: result.activities.length,
    })
  } catch (error) {
    console.error('Error fetching activity feed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch activity',
      },
      { status: 500 }
    )
  }
}
