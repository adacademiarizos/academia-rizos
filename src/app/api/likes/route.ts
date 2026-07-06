/**
 * POST /api/likes
 * Toggle like for a course or module
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  authorizeCourseAccessByCourseId,
  authorizeCourseAccessByModuleId,
  toAccessDeniedResponse,
} from '@/lib/course-access-control'
import { CommunityService } from '@/server/services/community-service'
import { NotificationService } from '@/server/services/notification-service'
import { AchievementService } from '@/server/services/achievement-service'
import { createLikeSchema } from '@/validators/academy'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = createLikeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { targetType, courseId, moduleId } = validation.data
    const access =
      targetType === 'MODULE' && moduleId
        ? await authorizeCourseAccessByModuleId(moduleId, {
            allowAdmin: true,
            requireActiveAccess: true,
          })
        : await authorizeCourseAccessByCourseId(courseId ?? '', {
            allowAdmin: true,
            requireActiveAccess: true,
          })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    const result = await CommunityService.toggleLike(access.user.id, targetType, courseId, moduleId)

    if (result.liked) {
      const targetId = courseId || moduleId || ''
      await Promise.all([
        NotificationService.triggerOnLike(access.user.id, targetType, targetId),
        AchievementService.recordActivity(access.user.id, 'LIKE', courseId, moduleId),
      ]).catch((error) => {
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
