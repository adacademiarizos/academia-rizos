/**
 * GET /api/courses/[courseId]/modules
 * Get course modules in preview mode or protected learning mode
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'
import { getCourseLessonProgress } from '@/server/services/academy-assessment-service'
import { CourseService } from '@/server/services/course-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const previewMode = request.nextUrl.searchParams.get('preview') === 'true'

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 })
    }

    const courseExists = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    })

    if (!courseExists) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 })
    }

    if (previewMode) {
      const modules = await CourseService.getCourseModules(courseId)

      return NextResponse.json({
        success: true,
        data: {
          modules,
          progress: 0,
        },
        count: modules.length,
      })
    }

    const access = await authorizeCourseAccessByCourseId(courseId, {
      allowAdmin: true,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    const modules = await CourseService.getCourseModules(
      courseId,
      access.viaAdmin ? undefined : access.user.id
    )

    const lessonProgress = access.viaAdmin
      ? { percentage: 0 }
      : await getCourseLessonProgress(access.user.id, courseId)

    return NextResponse.json({
      success: true,
      data: {
        modules,
        progress: lessonProgress.percentage,
      },
      count: modules.length,
    })
  } catch (error) {
    console.error('Error fetching course modules:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch modules' }, { status: 500 })
  }
}
