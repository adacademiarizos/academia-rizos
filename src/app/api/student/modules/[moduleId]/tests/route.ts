/**
 * GET /api/student/modules/[moduleId]/tests
 * Returns all tests for a module (for students with active access)
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

    const tests = await db.moduleTest.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        maxAttempts: true,
        passingScore: true,
        isRequired: true,
        _count: { select: { questions: true } },
      },
    })

    return NextResponse.json({ success: true, data: tests })
  } catch (error) {
    console.error('Error fetching module tests:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tests',
      },
      { status: 500 }
    )
  }
}
