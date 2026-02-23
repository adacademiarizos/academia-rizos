/**
 * GET /api/admin/courses/[courseId]/exam/questions - Get all exam questions
 * POST /api/admin/courses/[courseId]/exam/questions - Create exam question
 * PUT /api/admin/courses/[courseId]/exam/questions/[questionId] - Update question
 * DELETE /api/admin/courses/[courseId]/exam/questions/[questionId] - Delete question
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const CreateQuestionSchema = z.object({
  type: z.enum(['MULTIPLE_CHOICE', 'SHORT_ANSWER', 'FILE_UPLOAD', 'WRITTEN']),
  title: z.string().min(1, 'Question title is required'),
  description: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
})

const UpdateQuestionSchema = z.object({
  type: z.enum(['MULTIPLE_CHOICE', 'SHORT_ANSWER', 'FILE_UPLOAD', 'WRITTEN']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  order: z.number().int().min(0).optional(),
  config: z.record(z.string(), z.any()).optional(),
})

async function verifyAdmin() {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return null
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })

  return user?.role === 'ADMIN' ? user : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params

    // Check admin
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify exam exists
    const exam = await db.courseExam.findUnique({
      where: { courseId },
    })

    if (!exam) {
      return NextResponse.json(
        { success: false, error: 'Exam not found' },
        { status: 404 }
      )
    }

    // Get all questions
    const questions = await db.question.findMany({
      where: { examId: exam.id },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: questions,
    })
  } catch (error) {
    console.error('Error fetching exam questions:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch questions',
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params

    // Check admin
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify exam exists
    const exam = await db.courseExam.findUnique({
      where: { courseId },
    })

    if (!exam) {
      return NextResponse.json(
        { success: false, error: 'Exam not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = CreateQuestionSchema.parse(body)

    // Get next order
    const lastQuestion = await db.question.findFirst({
      where: { examId: exam.id },
      orderBy: { order: 'desc' },
    })

    const nextOrder = (lastQuestion?.order ?? -1) + 1

    // Create question
    const question = await db.question.create({
      data: {
        examId: exam.id,
        type: data.type,
        title: data.title,
        description: data.description || null,
        config: data.config || {},
        order: nextOrder,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: question,
      },
      { status: 201 }
    )
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

    console.error('Error creating question:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create question',
      },
      { status: 500 }
    )
  }
}
