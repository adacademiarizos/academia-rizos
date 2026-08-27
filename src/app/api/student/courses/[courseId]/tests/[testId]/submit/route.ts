import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { z } from 'zod'
import { db } from '@/lib/db'
import { NotificationService } from '@/server/services/notification-service'

const SubmitSchema = z.object({
  answers: z.record(z.string(), z.string()),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string }> }
) {
  try {
    const { courseId, testId } = await params
    const access = await authorizeCourseAccessByCourseId(courseId, {
      allowAdmin: false,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    const test = await db.courseTest.findUnique({
      where: { id: testId },
      include: { questions: true },
    })

    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const attemptCount = await db.courseTestSubmission.count({
      where: { courseTestId: testId, userId: access.user.id },
    })

    if (test.maxAttempts > 0 && attemptCount >= test.maxAttempts) {
      return NextResponse.json({ success: false, error: 'Maximum attempts reached' }, { status: 400 })
    }

    const body = await req.json()
    const { answers } = SubmitSchema.parse(body)

    const mcQuestions = test.questions.filter((question) => question.type === 'MULTIPLE_CHOICE')
    const nonMcQuestions = test.questions.filter((question) => question.type !== 'MULTIPLE_CHOICE')

    let correctCount = 0
    const questionResults: Array<{ questionId: string; answer: string; isCorrect: boolean | null }> = []

    for (const question of test.questions) {
      const answer = answers[question.id] ?? ''
      let isCorrect: boolean | null = null

      if (question.type === 'MULTIPLE_CHOICE') {
        const config = question.config as Record<string, any>
        const correctAnswer = config.correctAnswer ?? config.options?.[config.correctIndex ?? 0] ?? ''
        isCorrect = answer === correctAnswer
        if (isCorrect) correctCount++
      }

      questionResults.push({ questionId: question.id, answer, isCorrect })
    }

    let score: number | null = null
    let isPassed = false

    if (mcQuestions.length > 0) {
      score = (correctCount / mcQuestions.length) * 100
      isPassed = score >= test.passingScore
    }

    const hasManualReview = nonMcQuestions.length > 0
    const isFinalExam = test.isFinalExam
    const status = hasManualReview || isFinalExam ? 'PENDING' : isPassed ? 'APPROVED' : 'PENDING'

    const submission = await db.$transaction(async (tx) => {
      const createdSubmission = await tx.courseTestSubmission.create({
        data: {
          courseTestId: testId,
          userId: access.user.id,
          score,
          isPassed: !(hasManualReview || isFinalExam) && isPassed,
          attemptNumber: attemptCount + 1,
          status: status as any,
        },
      })

      await Promise.all(
        questionResults.map((result) =>
          tx.questionSubmission.create({
            data: {
              questionId: result.questionId,
              courseTestSubmissionId: createdSubmission.id,
              userId: access.user.id,
              answer: result.answer,
              isCorrect: result.isCorrect,
            },
          })
        )
      )

      return createdSubmission
    })

    await NotificationService.triggerOnAssessmentSubmission({
      userId: access.user.id,
      courseId,
      submissionId: submission.id,
      assessmentType: isFinalExam ? 'FINAL_EXAM' : 'COURSE_TEST',
      requiresReview: hasManualReview || isFinalExam,
    })

    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission.id,
        score,
        isPassed: submission.isPassed,
        attemptNumber: submission.attemptNumber,
        attemptsUsed: attemptCount + 1,
        attemptsRemaining: test.maxAttempts === 0 ? null : test.maxAttempts - (attemptCount + 1),
        maxAttempts: test.maxAttempts,
        passingScore: test.passingScore,
        hasManualReview,
        isFinalExam,
        status: submission.status,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 })
    }
    console.error('Error submitting test:', error)
    return NextResponse.json({ success: false, error: 'Failed to submit test' }, { status: 500 })
  }
}
