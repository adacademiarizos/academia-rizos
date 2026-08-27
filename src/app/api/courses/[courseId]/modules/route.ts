/**
 * GET /api/courses/[courseId]/modules
 * Returns the independent module and style sections for the learning area.
 * The route name is kept for backward compatibility with existing links.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'
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

    const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, contentStructure: true } })
    if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 })

    if (previewMode) {
      const [modules, styles] = await Promise.all([
        CourseService.getCourseModules(courseId),
        CourseService.getCourseStyles(courseId),
      ])
      return NextResponse.json({
        success: true,
        data: { modules, styles, contentStructure: course.contentStructure, progress: 0 },
        count: modules.length + styles.length,
      })
    }

    const access = await authorizeCourseAccessByCourseId(courseId, { allowAdmin: true, requireActiveAccess: true })
    if (!access.ok) return toAccessDeniedResponse(access)

    const userId = access.viaAdmin ? undefined : access.user.id
    const [modules, styles] = await Promise.all([
      CourseService.getCourseModules(courseId, userId),
      CourseService.getCourseStyles(courseId, userId),
    ])
    const units = [...modules, ...styles]
    const completedUnits = units.filter((unit) => 'completed' in unit && unit.completed).length
    const progress = units.length > 0 ? Math.round((completedUnits / units.length) * 100) : 0

    return NextResponse.json({
      success: true,
      data: { modules, styles, contentStructure: course.contentStructure, progress },
      count: units.length,
    })
  } catch (error) {
    console.error('Error fetching course content:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch course content' }, { status: 500 })
  }
}
