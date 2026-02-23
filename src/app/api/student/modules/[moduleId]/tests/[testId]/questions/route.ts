/**
 * GET /api/student/modules/[moduleId]/tests/[testId]/questions
 * Returns test questions for students (strips correctAnswer to prevent cheating)
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
      include: { module: { select: { courseId: true } } },
    })

    if (!test || test.moduleId !== moduleId) {
      return NextResponse.json(
        { success: false, error: 'Test not found' },
        { status: 404 }
      )
    }

    // Verify student has course access
    const access = await db.courseAccess.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: test.module.courseId } },
    })

    if (!access) {
      return NextResponse.json(
        { success: false, error: 'Course access required' },
        { status: 403 }
      )
    }

    const questions = await db.question.findMany({
      where: { testId },
      orderBy: { order: 'asc' },
    })

    // Strip correctAnswer from config to prevent cheating
    const sanitizedQuestions = questions.map((q) => {
      const config = { ...(q.config as Record<string, unknown>) }
      delete config.correctAnswer
      return { ...q, config }
    })

    return NextResponse.json({
      success: true,
      data: sanitizedQuestions,
    })
  } catch (error) {
    console.error('Error fetching questions:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch questions',
      },
      { status: 500 }
    )
  }
}
