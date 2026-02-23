/**
 * GET /api/likes/my-likes
 * Get user's liked items
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { CommunityService } from '@/server/services/community-service'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    // Get user from database
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

    // Get user's likes
    const likes = await CommunityService.getUserLikes(user.id)

    return NextResponse.json({
      success: true,
      data: likes,
    })
  } catch (error) {
    console.error('Error fetching user likes:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user likes',
      },
      { status: 500 }
    )
  }
}
