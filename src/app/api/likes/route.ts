/**
 * POST /api/likes
 * Toggle like for a course or module
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { CommunityService } from '@/server/services/community-service'
import { NotificationService } from '@/server/services/notification-service'
import { AchievementService } from '@/server/services/achievement-service'
import { createLikeSchema } from '@/validators/academy'

export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json()
    const validation = createLikeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { targetType, courseId, moduleId } = validation.data

    // Toggle like
    const result = await CommunityService.toggleLike(user.id, targetType, courseId, moduleId)

    // If like was just created (not deleted), trigger notifications and activity
    if (result.liked) {
      const targetId = courseId || moduleId || ''
      await Promise.all([
        NotificationService.triggerOnLike(user.id, targetType, targetId),
        AchievementService.recordActivity(user.id, 'LIKE', courseId, moduleId),
      ]).catch((error) => {
        // Don't fail the request if notifications fail
        console.error('Error with notifications/achievements:', error)
      })
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Error toggling like:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle like',
      },
      { status: 500 }
    )
  }
}
