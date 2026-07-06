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

    const sanitized = questions.map((question) => {
      if (question.type === 'MULTIPLE_CHOICE') {
        const config = question.config as Record<string, unknown>
        const { correctAnswer, correctIndex, ...rest } = config
        return { ...question, config: rest }
      }

      return question
    })

    return NextResponse.json({ success: true, data: sanitized })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch questions' }, { status: 500 })
  }
}
