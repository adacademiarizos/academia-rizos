/**
 * GET /api/comments - List comments for course/module
 * POST /api/comments - Create a comment
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
import { createCommentSchema } from '@/validators/academy'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId') || undefined
    const moduleId = searchParams.get('moduleId') || undefined
    const limitParam = searchParams.get('limit') || '20'
    const offsetParam = searchParams.get('offset') || '0'

    const limit = Math.min(Math.max(parseInt(limitParam), 1), 100)
    const offset = Math.max(parseInt(offsetParam), 0)

    if (!courseId && !moduleId) {
      return NextResponse.json(
        { success: false, error: 'Either courseId or moduleId query parameter must be provided' },
        { status: 400 }
      )
    }

    if (moduleId) {
      const access = await authorizeCourseAccessByModuleId(moduleId, {
        allowAdmin: true,
        requireActiveAccess: true,
      })

      if (!access.ok) {
        return toAccessDeniedResponse(access)
      }
    }

    const result = await CommunityService.getComments(courseId, moduleId, limit, offset)

    return NextResponse.json({
      success: true,
      data: result,
      count: result.comments.length,
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch comments',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = createCommentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { targetType, body: commentBody, courseId, moduleId } = validation.data
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

    const comment = await CommunityService.createComment(
      access.user.id,
      targetType,
      commentBody,
      courseId,
      moduleId
    )

    const targetId = courseId || moduleId || ''
    await Promise.all([
      NotificationService.triggerOnComment(access.user.id, comment.id, targetType, targetId),
      AchievementService.recordActivity(access.user.id, 'COMMENT_POSTED', courseId, moduleId),
    ]).catch((error) => {
      console.error('Error with notifications/achievements:', error)
    })

    return NextResponse.json({
      success: true,
      data: comment,
    })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create comment',
      },
      { status: 500 }
    )
  }
}
