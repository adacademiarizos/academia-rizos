/**
 * GET /api/courses/[courseId]/modules
 * Get list of modules for a course with progress (if user is logged in)
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

    // Check if course exists
    const courseExists = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    })

    if (!courseExists) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      )
    }

    // Get user session to include progress if available
    const session = await getServerSession()
    const userId = session?.user?.email
      ? (
          await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
          })
        )?.id
      : undefined

    const modules = await CourseService.getCourseModules(courseId, userId)

    // Calculate progress
    const totalModules = modules.length
    const completedModules = modules.filter((m: any) => m.completed).length
    const progress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0

    return NextResponse.json({
      success: true,
      data: {
        modules,
        progress,
      },
      count: modules.length,
    })
  } catch (error) {
    console.error('Error fetching course modules:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch modules' },
      { status: 500 }
    )
  }
}
