/**
 * GET /api/comments - List comments for course/module
 * POST /api/comments - Create a comment
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { CommunityService } from '@/server/services/community-service'
import { NotificationService } from '@/server/services/notification-service'
import { AchievementService } from '@/server/services/achievement-service'
import { createCommentSchema } from '@/validators/academy'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetType = searchParams.get('targetType') as 'COURSE' | 'MODULE' | null
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

    // Get comments
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
    const validation = createCommentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { targetType, body: commentBody, courseId, moduleId } = validation.data

    // Create comment
    const comment = await CommunityService.createComment(
      user.id,
      targetType,
      commentBody,
      courseId,
      moduleId
    )

    // Trigger notifications and activity recording
    const targetId = courseId || moduleId || ''
    await Promise.all([
      NotificationService.triggerOnComment(user.id, comment.id, targetType, targetId),
      AchievementService.recordActivity(user.id, 'COMMENT_POSTED', courseId, moduleId),
    ]).catch((error) => {
      // Don't fail the request if notifications fail
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
