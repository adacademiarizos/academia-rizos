/**
 * GET /api/likes/count
 * Get like counts for courses and modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { CommunityService } from '@/server/services/community-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const courseIdsParam = searchParams.get('courseIds')
    const moduleIdsParam = searchParams.get('moduleIds')

    // Parse comma-separated IDs
    const courseIds = courseIdsParam ? courseIdsParam.split(',').filter((id) => id.trim()) : undefined
    const moduleIds = moduleIdsParam ? moduleIdsParam.split(',').filter((id) => id.trim()) : undefined

    if (!courseIds && !moduleIds) {
      return NextResponse.json(
        { success: false, error: 'Either courseIds or moduleIds query parameter must be provided' },
        { status: 400 }
      )
    }

    // Get like counts
    const counts = await CommunityService.getLikeCounts(courseIds, moduleIds)

    return NextResponse.json({
      success: true,
      data: counts,
    })
  } catch (error) {
    console.error('Error fetching like counts:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch like counts',
      },
      { status: 500 }
    )
  }
}
