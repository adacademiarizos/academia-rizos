/**
 * POST /api/student/courses/[courseId]/exam/submit - Submit course final exam
 * Auto-grades multiple choice questions, requires manual review for others
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const SubmitExamSchema = z.object({
  answers: z.record(
    z.string(), // questionId
    z.any() // answer
  ),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
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
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const { courseId } = await params

    // Verify course and exam exist
    const exam = await db.courseExam.findUnique({
      where: { courseId },
      include: {
        questions: true,
        course: true,
      },
    })

    if (!exam) {
      return NextResponse.json(
        { success: false, error: 'Exam not found' },
        { status: 404 }
      )
    }

    // Verify student has access to course
    const courseAccess = await db.courseAccess.findUnique({
      where: {
        userId_courseId: { userId: user.id, courseId },
      },
    })

    if (!courseAccess) {
      return NextResponse.json(
        { success: false, error: 'Course access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { answers } = SubmitExamSchema.parse(body)

    // Calculate score
    let correctCount = 0
    let autoGradedCount = 0

    for (const question of exam.questions) {
      const answer = answers[question.id]

      if (question.type === 'MULTIPLE_CHOICE' && answer) {
        autoGradedCount++
        if (answer === question.config.correctAnswer) {
          correctCount++
        }
      }
    }

    // Calculate overall score (based only on auto-graded questions)
    const scorePercentage =
      autoGradedCount > 0 ? (correctCount / autoGradedCount) * 100 : 0
    const isPassed = scorePercentage >= exam.passingScore

    // Check if user already submitted
    const existingSubmission = await db.examSubmission.findUnique({
      where: {
        examId_userId: { examId: exam.id, userId: user.id },
      },
    })

    let submission
    if (existingSubmission) {
      // Update existing submission — reset to PENDING for new review
      submission = await db.examSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          score: scorePercentage,
          isPassed,
          status: 'PENDING',
          reviewedAt: null,
          reviewNote: null,
          submittedAt: new Date(),
        },
      })
    } else {
      // Create new submission — always PENDING, awaiting admin approval
      submission = await db.examSubmission.create({
        data: {
          examId: exam.id,
          userId: user.id,
          score: scorePercentage,
          isPassed,
          status: 'PENDING',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission.id,
        score: scorePercentage,
        isPassed,
        passingScore: exam.passingScore,
        correctCount,
        totalAutoGradedQuestions: autoGradedCount,
        pending: true,
        message: 'Tu examen fue enviado. Un administrador lo revisará y recibirás tu certificado cuando sea aprobado.',
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

    console.error('Error submitting exam:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit exam',
      },
      { status: 500 }
    )
  }
}
