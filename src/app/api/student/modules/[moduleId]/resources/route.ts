/**
 * GET /api/student/modules/[moduleId]/resources
 * Returns all resources for a module (for enrolled students)
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

    const resources = await db.moduleResource.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
        order: true,
      },
    })

    return NextResponse.json({ success: true, data: resources })
  } catch (error) {
    console.error('Error fetching module resources:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch resources',
      },
      { status: 500 }
    )
  }
}
