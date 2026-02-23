/**
 * GET /api/me/stats
 * Get current user's personal statistics
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

    // Get dashboard snapshot
    const dashboard = await AnalyticsService.getDashboardSnapshot(user.id)

    return NextResponse.json({
      success: true,
      data: dashboard,
    })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch statistics',
      },
      { status: 500 }
    )
  }
}
