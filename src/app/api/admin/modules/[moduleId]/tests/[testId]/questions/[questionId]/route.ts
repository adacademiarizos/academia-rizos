/**
 * PUT /api/admin/modules/[moduleId]/tests/[testId]/questions/[questionId] - Update question
 * DELETE /api/admin/modules/[moduleId]/tests/[testId]/questions/[questionId] - Delete question
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

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

export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ moduleId: string; testId: string; questionId: string }>
  }
) {
  try {
    const { moduleId, testId, questionId } = await params

    // Check admin
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify question exists and belongs to test
    const question = await db.question.findUnique({
      where: { id: questionId },
    })

    if (!question || question.testId !== testId) {
      return NextResponse.json(
        { success: false, error: 'Question not found' },
        { status: 404 }
      )
    }

    // Verify test belongs to module
    const test = await db.moduleTest.findUnique({
      where: { id: testId },
    })

    if (!test || test.moduleId !== moduleId) {
      return NextResponse.json(
        { success: false, error: 'Test not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = UpdateQuestionSchema.parse(body)

    // Update question
    const updated = await db.question.update({
      where: { id: questionId },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.config && { config: data.config }),
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
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

    console.error('Error updating question:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update question',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ moduleId: string; testId: string; questionId: string }>
  }
) {
  try {
    const { moduleId, testId, questionId } = await params

    // Check admin
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify question exists and belongs to test
    const question = await db.question.findUnique({
      where: { id: questionId },
    })

    if (!question || question.testId !== testId) {
      return NextResponse.json(
        { success: false, error: 'Question not found' },
        { status: 404 }
      )
    }

    // Verify test belongs to module
    const test = await db.moduleTest.findUnique({
      where: { id: testId },
    })

    if (!test || test.moduleId !== moduleId) {
      return NextResponse.json(
        { success: false, error: 'Test not found' },
        { status: 404 }
      )
    }

    // Delete question (cascade deletes submissions)
    const deleted = await db.question.delete({
      where: { id: questionId },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: deleted.id,
        title: deleted.title,
        message: 'Question deleted successfully',
      },
    })
  } catch (error) {
    console.error('Error deleting question:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete question',
      },
      { status: 500 }
    )
  }
}
