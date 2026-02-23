/**
 * GET /api/courses/[courseId]
 * Get detailed course information with landing page data
 */

import { NextRequest, NextResponse } from 'next/server'
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

    const course = await CourseService.getCourseById(courseId)

    return NextResponse.json({
      success: true,
      data: course,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Course not found') {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      )
    }

    console.error('Error fetching course:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch course' },
      { status: 500 }
    )
  }
}
