/**
 * GET /api/courses/[courseId]/test
 * Get test schema for a course (only if user has access and completed all modules)
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

    // Get user
    const session = await getServerSession()

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    // Check course access
    const access = await CourseService.checkUserAccess(user.id, courseId)

    if (!access.hasAccess) {
      return NextResponse.json(
        { success: false, error: 'No access to this course' },
        { status: 403 }
      )
    }

    // Check if all modules are completed
    const moduleCount = await db.module.count({
      where: { courseId },
    })

    const completedCount = await db.moduleProgress.count({
      where: {
        userId: user.id,
        module: { courseId },
        completed: true,
      },
    })

    if (completedCount < moduleCount || moduleCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Must complete all modules before taking the test',
          data: {
            modulesCompleted: completedCount,
            modulesRequired: moduleCount,
          },
        },
        { status: 400 }
      )
    }

    // Get test (now we know user is eligible)
    const test = await CourseService.getCourseTest(courseId)

    // Check if user already has a submission
    const existingSubmission = await db.submission.findUnique({
      where: {
        testId_userId: { testId: test.id, userId: user.id },
      },
      select: {
        id: true,
        status: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: test.id,
        courseId,
        schema: test.schemaJson,
        existingSubmission,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Test not found for this course') {
      return NextResponse.json(
        { success: false, error: 'No test available for this course' },
        { status: 404 }
      )
    }

    console.error('Error fetching test:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch test' },
      { status: 500 }
    )
  }
}
