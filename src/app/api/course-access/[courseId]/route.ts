/**
 * GET /api/course-access/[courseId]
 * Check if current user has access to a course
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { db } from '@/lib/db'
import { CourseService } from '@/server/services/course-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      )
    }

    // Get current user session
    const session = await getServerSession()

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          success: true,
          data: {
            hasAccess: false,
            isExpired: false,
            accessUntil: null,
            requiresLogin: true,
          },
        },
        { status: 200 }
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

    // Check access
    const access = await CourseService.checkUserAccess(user.id, courseId)

    return NextResponse.json({
      success: true,
      data: access,
    })
  } catch (error) {
    console.error('Error checking course access:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check access' },
      { status: 500 }
    )
  }
}
