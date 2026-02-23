import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'

async function requireStudent(courseId: string) {
  const session = await getServerSession()
  if (!session?.user?.email) return null
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } })
  if (!user) return null
  const access = await db.courseAccess.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  })
  if (!access) return null
  if (access.accessUntil && access.accessUntil < new Date()) return null
  return user
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string }> }
) {
  try {
    const { courseId, testId } = await params
    const user = await requireStudent(courseId)
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const test = await db.courseTest.findUnique({
      where: { id: testId },
      select: { courseId: true, maxAttempts: true, passingScore: true },
    })
    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const submissions = await db.courseTestSubmission.findMany({
      where: { courseTestId: testId, userId: user.id },
      orderBy: { attemptNumber: 'asc' },
      select: { id: true, score: true, isPassed: true, attemptNumber: true, status: true, submittedAt: true },
    })

    const attemptsUsed = submissions.length
    const bestScore = submissions.reduce((max, s) => (s.score !== null && s.score > (max ?? -1) ? s.score : max), null as number | null)
    const alreadyPassed = submissions.some((s) => s.isPassed)
    const attemptsRemaining = test.maxAttempts === 0 ? null : Math.max(0, test.maxAttempts - attemptsUsed)

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
