/**
 * GET /api/student/modules/[moduleId]/tests/[testId]/status
 * Returns student's attempt summary for a test: attempts used, best score, pass status
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByModuleId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; testId: string }> }
) {
  try {
    const { moduleId, testId } = await params
    const access = await authorizeCourseAccessByModuleId(moduleId, {
      allowAdmin: true,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    const test = await db.moduleTest.findUnique({
      where: { id: testId },
      select: {
        moduleId: true,
        maxAttempts: true,
        passingScore: true,
      },
    })

    if (!test || test.moduleId !== moduleId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const submissions = await db.moduleSubmission.findMany({
      where: { testId, userId: access.user.id },
      select: { score: true, isPassed: true, attemptNumber: true },
      orderBy: { submittedAt: 'asc' },
    })

    const attemptsUsed = submissions.length
    const bestScore =
      submissions.length > 0 ? Math.max(...submissions.map((submission) => submission.score ?? 0)) : null
    const alreadyPassed = submissions.some((submission) => submission.isPassed)
    const attemptsRemaining =
      test.maxAttempts === 0 ? null : Math.max(0, test.maxAttempts - attemptsUsed)

    return NextResponse.json({
      success: true,
      data: {
        attemptsUsed,
        maxAttempts: test.maxAttempts,
        attemptsRemaining,
        bestScore,
        alreadyPassed,
        passingScore: test.passingScore,
      },
    })
  } catch (error) {
    console.error('Error fetching test status:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch test status',
      },
      { status: 500 }
    )
  }
}
