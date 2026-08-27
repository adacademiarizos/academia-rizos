/**
 * GET /api/student/modules/[moduleId]/lessons
 * Returns all lessons for a module (for students with active access)
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByModuleId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params
    const access = await authorizeCourseAccessByModuleId(moduleId, {
      allowAdmin: true,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    const lessons = await db.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        styleId: true,
        order: true,
        title: true,
        description: true,
        videoUrl: true,
        videoFileUrl: true,
        transcript: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: lessons,
      videoExpired: false,
    })
  } catch (error) {
    console.error('Error fetching lessons:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch lessons',
      },
      { status: 500 }
    )
  }
}
