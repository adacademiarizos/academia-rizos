/**
 * GET /api/course-access/[courseId]
 * Check if current user has access to a course
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByCourseId } from '@/lib/course-access-control'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 })
    }

    const access = await authorizeCourseAccessByCourseId(courseId, {
      allowAdmin: true,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      if (access.code === 'SIGN_IN_REQUIRED') {
        return NextResponse.json(
          {
            success: true,
            data: {
              hasAccess: false,
              isExpired: false,
              accessUntil: null,
              requiresLogin: true,
              reason: 'SIGN_IN_REQUIRED',
              viaAdmin: false,
            },
          },
          { status: 200 }
        )
      }

      if (access.code === 'COURSE_PURCHASE_REQUIRED' || access.code === 'COURSE_ACCESS_EXPIRED') {
        return NextResponse.json(
          {
            success: true,
            data: {
              hasAccess: false,
              isExpired: access.code === 'COURSE_ACCESS_EXPIRED',
              accessUntil: null,
              requiresLogin: false,
              reason: access.code,
              viaAdmin: false,
            },
          },
          { status: 200 }
        )
      }

      return NextResponse.json(
        { success: false, error: access.message, code: access.code },
        { status: access.status }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        hasAccess: true,
        isExpired: false,
        accessUntil: access.accessUntil,
        requiresLogin: false,
        reason: null,
        viaAdmin: access.viaAdmin,
      },
    })
  } catch (error) {
    console.error('Error checking course access:', error)
    return NextResponse.json({ success: false, error: 'Failed to check access' }, { status: 500 })
  }
}
