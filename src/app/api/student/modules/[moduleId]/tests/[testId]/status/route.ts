/**
 * GET /api/student/modules/[moduleId]/tests/[testId]/status
 * Returns student's attempt summary for a test: attempts used, best score, pass status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; testId: string }> }
) {
  try {
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

    const { moduleId, testId } = await params

    const test = await db.moduleTest.findUnique({
      where: { id: testId },
      select: {
        moduleId: true,
        maxAttempts: true,
        passingScore: true,
      },
    })

    if (!test || test.moduleId !== moduleId) {
      return NextResponse.json(
        { success: false, error: 'Test not found' },
        { status: 404 }
      )
    }

    // Fetch all submissions for this user+test
    const submissions = await db.moduleSubmission.findMany({
      where: { testId, userId: user.id },
      select: { score: true, isPassed: true, attemptNumber: true },
      orderBy: { submittedAt: 'asc' },
    })

    const attemptsUsed = submissions.length
    const bestScore =
      submissions.length > 0
        ? Math.max(...submissions.map((s) => s.score ?? 0))
        : null
    const alreadyPassed = submissions.some((s) => s.isPassed)
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
