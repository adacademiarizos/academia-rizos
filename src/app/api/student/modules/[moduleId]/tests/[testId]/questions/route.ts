/**
 * GET /api/student/modules/[moduleId]/tests/[testId]/questions
 * Returns test questions for students (strips correctAnswer to prevent cheating)
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
      select: { moduleId: true },
    })

    if (!test || test.moduleId !== moduleId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const questions = await db.question.findMany({
      where: { testId },
      orderBy: { order: 'asc' },
    })

    const sanitizedQuestions = questions.map((question) => {
      const config = { ...(question.config as Record<string, unknown>) }
      delete config.correctAnswer
      return { ...question, config }
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
