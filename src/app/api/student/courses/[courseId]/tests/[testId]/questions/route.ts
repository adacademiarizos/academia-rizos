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
      select: { courseId: true },
    })
    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const questions = await db.question.findMany({
      where: { courseTestId: testId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        order: true,
        config: true,
      },
    })

    // For MULTIPLE_CHOICE, strip the correct answer from config
    const sanitized = questions.map((q) => {
      if (q.type === 'MULTIPLE_CHOICE') {
        const cfg = q.config as Record<string, any>
        const { correctAnswer, correctIndex, ...rest } = cfg
        return { ...q, config: rest }
      }
      return q
    })

    return NextResponse.json({ success: true, data: sanitized })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch questions' }, { status: 500 })
  }
}
