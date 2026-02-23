/**
 * GET /api/users/[userId]/activity
 * Get public user activity feed
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { AnalyticsService } from '@/server/services/analytics-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: userId },
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
    const result = await AnalyticsService.getActivityFeed(userId, limit, offset)

    return NextResponse.json({
      success: true,
      data: result.activities,
      total: result.total,
      count: result.activities.length,
    })
  } catch (error) {
    console.error('Error fetching user activity:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch activity',
      },
      { status: 500 }
    )
  }
}
