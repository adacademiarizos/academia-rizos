/**
 * POST /api/student/modules/[moduleId]/tests/[testId]/submit - Submit module test
 * Supports multiple attempts. Best score counts. Enforces maxAttempts per test config.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByModuleId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'
import { z } from 'zod'

const SubmitTestSchema = z.object({
  answers: z.record(
    z.string(),
    z.any()
  ),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; testId: string }> }
) {
  try {
    const { moduleId, testId } = await params
    const access = await authorizeCourseAccessByModuleId(moduleId, {
      allowAdmin: false,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    const test = await db.moduleTest.findUnique({
      where: { id: testId },
      include: {
        module: { select: { courseId: true } },
        questions: true,
      },
    })

    if (!test || test.moduleId !== moduleId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const attemptCount = await db.moduleSubmission.count({
      where: { testId, userId: access.user.id },
    })

    if (test.maxAttempts > 0 && attemptCount >= test.maxAttempts) {
      return NextResponse.json(
        {
          success: false,
          error: 'Maximum attempts reached',
          data: {
            attemptsUsed: attemptCount,
            maxAttempts: test.maxAttempts,
            attemptsRemaining: 0,
          },
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { answers } = SubmitTestSchema.parse(body)

    let correctCount = 0
    const questionSubmissions: Array<{
      questionId: string
      answer: string
      isCorrect: boolean
      score: number
    }> = []

    for (const question of test.questions) {
      const answer = answers[question.id]
      let isCorrect = false
      let score = 0

      if (question.type === 'MULTIPLE_CHOICE') {
        const config = question.config as { correctAnswer?: string }
        isCorrect = answer === config.correctAnswer
        score = isCorrect ? 1 : 0
        if (isCorrect) correctCount++
      }

      questionSubmissions.push({
        questionId: question.id,
        answer: typeof answer === 'string' ? answer : JSON.stringify(answer),
        isCorrect,
        score,
      })
    }

    const scorePercentage =
      test.questions.length > 0 ? (correctCount / test.questions.length) * 100 : 0
    const isPassed = test.questions.length > 0 ? scorePercentage >= test.passingScore : false
    const currentAttemptNumber = attemptCount + 1

    const submission = await db.moduleSubmission.create({
      data: {
        moduleId,
        testId,
        userId: access.user.id,
        score: scorePercentage,
        isPassed,
        attemptNumber: currentAttemptNumber,
      },
    })

    await Promise.all(
      questionSubmissions.map((questionSubmission) =>
        db.questionSubmission.create({
          data: {
            questionId: questionSubmission.questionId,
            submissionId: submission.id,
            userId: access.user.id,
            answer: questionSubmission.answer,
            isCorrect: questionSubmission.isCorrect || null,
            score: questionSubmission.score || null,
          },
        })
      )
    )

    if (isPassed && test.isRequired) {
      await db.userActivity.create({
        data: {
          userId: access.user.id,
          type: 'MODULE_COMPLETED',
          moduleId,
          courseId: test.module.courseId,
          metadata: { testId, score: scorePercentage },
        },
      })

      await db.moduleProgress.upsert({
        where: {
          userId_moduleId: { userId: access.user.id, moduleId },
        },
        update: {
          completed: true,
          completedAt: new Date(),
        },
        create: {
          userId: access.user.id,
          moduleId,
          completed: true,
          completedAt: new Date(),
        },
      })
    }

    const attemptsRemaining =
      test.maxAttempts === 0 ? null : test.maxAttempts - currentAttemptNumber

    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission.id,
        score: scorePercentage,
        isPassed,
        correctCount,
        totalQuestions: test.questions.length,
        passingScore: test.passingScore,
        attemptNumber: currentAttemptNumber,
        attemptsUsed: currentAttemptNumber,
        attemptsRemaining,
        maxAttempts: test.maxAttempts,
        message: isPassed ? 'Test aprobado.' : 'Test no aprobado. Intenta de nuevo.',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      )
    }

    console.error('Error submitting test:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit test',
      },
      { status: 500 }
    )
  }
}
