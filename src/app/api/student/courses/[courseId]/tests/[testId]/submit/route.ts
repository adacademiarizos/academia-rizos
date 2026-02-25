import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { db } from '@/lib/db'

const SubmitSchema = z.object({
  answers: z.record(z.string(), z.string()), // questionId -> answer (JSON string or plain text or URL)
})

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string }> }
) {
  try {
    const { courseId, testId } = await params
    const user = await requireStudent(courseId)
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const test = await db.courseTest.findUnique({
      where: { id: testId },
      include: { questions: true },
    })
    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    // Check attempt limit
    const attemptCount = await db.courseTestSubmission.count({
      where: { courseTestId: testId, userId: user.id },
    })
    if (test.maxAttempts > 0 && attemptCount >= test.maxAttempts) {
      return NextResponse.json({ success: false, error: 'Maximum attempts reached' }, { status: 400 })
    }

    const body = await req.json()
    const { answers } = SubmitSchema.parse(body)

    // Grade MC questions
    const mcQuestions = test.questions.filter((q) => q.type === 'MULTIPLE_CHOICE')
    const nonMcQuestions = test.questions.filter((q) => q.type !== 'MULTIPLE_CHOICE')

    let correctCount = 0
    const questionResults: Array<{ questionId: string; answer: string; isCorrect: boolean | null }> = []

    for (const question of test.questions) {
      const answer = answers[question.id] ?? ''
      let isCorrect: boolean | null = null

      if (question.type === 'MULTIPLE_CHOICE') {
        const cfg = question.config as Record<string, any>
        const correctAnswer = cfg.correctAnswer ?? cfg.options?.[cfg.correctIndex ?? 0] ?? ''
        isCorrect = answer === correctAnswer
        if (isCorrect) correctCount++
      }
      // WRITTEN and FILE_UPLOAD remain null (manual review)

      questionResults.push({ questionId: question.id, answer, isCorrect })
    }

    // Compute MC score
    let score: number | null = null
    let isPassed = false

    if (mcQuestions.length > 0) {
      score = mcQuestions.length > 0 ? (correctCount / mcQuestions.length) * 100 : null
      isPassed = score !== null && score >= test.passingScore
    }

    // If there are non-MC questions OR this is a final exam, keep submission PENDING
    const hasManualReview = nonMcQuestions.length > 0
    const isFinalExam = test.isFinalExam
    const status = (hasManualReview || isFinalExam) ? 'PENDING' : (isPassed ? 'APPROVED' : 'PENDING')

    // Create submission + answers in a transaction
    const submission = await db.$transaction(async (tx) => {
      const sub = await tx.courseTestSubmission.create({
        data: {
          courseTestId: testId,
          userId: user.id,
          score,
          isPassed: !(hasManualReview || isFinalExam) && isPassed,
          attemptNumber: attemptCount + 1,
          status: status as any,
        },
      })

      await Promise.all(
        questionResults.map((r) =>
          tx.questionSubmission.create({
            data: {
              questionId: r.questionId,
              courseTestSubmissionId: sub.id,
              userId: user.id,
              answer: r.answer,
              isCorrect: r.isCorrect,
            },
          })
        )
      )

      return sub
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
