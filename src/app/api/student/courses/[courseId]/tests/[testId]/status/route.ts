import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string }> }
) {
  try {
    const { courseId, testId } = await params
    const access = await authorizeCourseAccessByCourseId(courseId, {
      allowAdmin: true,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    const test = await db.courseTest.findUnique({
      where: { id: testId },
      select: { courseId: true, maxAttempts: true, passingScore: true },
    })

    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const submissions = await db.courseTestSubmission.findMany({
      where: { courseTestId: testId, userId: access.user.id },
      orderBy: { attemptNumber: 'asc' },
      select: {
        id: true,
        score: true,
        isPassed: true,
        attemptNumber: true,
        status: true,
        submittedAt: true,
      },
    })

    const attemptsUsed = submissions.length
    const bestScore = submissions.reduce(
      (max, submission) =>
        submission.score !== null && submission.score > (max ?? -1) ? submission.score : max,
      null as number | null
    )
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
        submissions,
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch status' }, { status: 500 })
  }
}
