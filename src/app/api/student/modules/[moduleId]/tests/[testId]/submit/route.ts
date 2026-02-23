/**
 * POST /api/student/modules/[moduleId]/tests/[testId]/submit - Submit module test
 * Supports multiple attempts. Best score counts. Enforces maxAttempts per test config.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const SubmitTestSchema = z.object({
  answers: z.record(
    z.string(), // questionId
    z.any() // answer can be string, object, etc
  ),
})

async function verifyStudentAccess(userId: string, courseId: string) {
  const access = await db.courseAccess.findUnique({
    where: {
      userId_courseId: { userId, courseId },
    },
  })

  return !!access
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; testId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const { moduleId, testId } = await params

    // Verify module and test exist
    const test = await db.moduleTest.findUnique({
      where: { id: testId },
      include: {
        module: { select: { courseId: true } },
        questions: true,
      },
    })

    if (!test || test.moduleId !== moduleId) {
      return NextResponse.json(
        { success: false, error: 'Test not found' },
        { status: 404 }
      )
    }

    // Verify student has access to course
    const hasAccess = await verifyStudentAccess(user.id, test.module.courseId)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Course access required' },
        { status: 403 }
      )
    }

    // Count existing attempts
    const attemptCount = await db.moduleSubmission.count({
      where: { testId, userId: user.id },
    })

    // Enforce maxAttempts (0 = unlimited)
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

    // Calculate score
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

    // Calculate overall score using test's configured passingScore
    const scorePercentage =
      test.questions.length > 0 ? (correctCount / test.questions.length) * 100 : 0
    const isPassed = test.questions.length > 0 ? scorePercentage >= test.passingScore : false

    const currentAttemptNumber = attemptCount + 1

    // Always create a new submission (allows multiple attempts)
    const submission = await db.moduleSubmission.create({
      data: {
        moduleId,
        testId,
        userId: user.id,
        score: scorePercentage,
        isPassed,
        attemptNumber: currentAttemptNumber,
      },
    })

    // Save individual question responses
    await Promise.all(
      questionSubmissions.map((qs) =>
        db.questionSubmission.create({
          data: {
            questionId: qs.questionId,
            submissionId: submission.id,
            userId: user.id,
            answer: qs.answer,
            isCorrect: qs.isCorrect || null,
            score: qs.score || null,
          },
        })
      )
    )

    // If test is passed and required, record activity and mark module progress
    if (isPassed && test.isRequired) {
      await db.userActivity.create({
        data: {
          userId: user.id,
          type: 'MODULE_COMPLETED',
          moduleId,
          courseId: test.module.courseId,
          metadata: { testId, score: scorePercentage },
        },
      })

      await db.moduleProgress.upsert({
        where: {
          userId_moduleId: { userId: user.id, moduleId },
        },
        update: {
          completed: true,
          completedAt: new Date(),
        },
        create: {
          userId: user.id,
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
        message: isPassed ? '¡Test aprobado!' : 'Test no aprobado. Intenta de nuevo.',
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
