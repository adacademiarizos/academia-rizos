/**
 * GET /api/admin/modules/[moduleId]/tests/[testId] - Get a specific test with questions
 * PUT /api/admin/modules/[moduleId]/tests/[testId] - Update test
 * DELETE /api/admin/modules/[moduleId]/tests/[testId] - Delete test
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const UpdateTestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  isRequired: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  maxAttempts: z.number().int().min(0).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
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
  { params }: { params: Promise<{ moduleId: string; testId: string }> }
) {
  try {
    const { moduleId, testId } = await params

    // Check admin
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify test exists and belongs to module
    const test = await db.moduleTest.findUnique({
      where: { id: testId },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    })

    if (!test || test.moduleId !== moduleId) {
      return NextResponse.json(
        { success: false, error: 'Test not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: test,
    })
  } catch (error) {
    console.error('Error fetching test:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch test',
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; testId: string }> }
) {
  try {
    const { moduleId, testId } = await params

    // Check admin
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify test exists and belongs to module
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
    const data = UpdateTestSchema.parse(body)

    // Update test
    const updated = await db.moduleTest.update({
      where: { id: testId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.maxAttempts !== undefined && { maxAttempts: data.maxAttempts }),
        ...(data.passingScore !== undefined && { passingScore: data.passingScore }),
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

    console.error('Error updating test:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update test',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; testId: string }> }
) {
  try {
    const { moduleId, testId } = await params

    // Check admin
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify test exists and belongs to module
    const test = await db.moduleTest.findUnique({
      where: { id: testId },
    })

    if (!test || test.moduleId !== moduleId) {
      return NextResponse.json(
        { success: false, error: 'Test not found' },
        { status: 404 }
      )
    }

    // Delete test (cascade deletes questions and submissions)
    const deleted = await db.moduleTest.delete({
      where: { id: testId },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: deleted.id,
        title: deleted.title,
        message: 'Test deleted successfully',
      },
    })
  } catch (error) {
    console.error('Error deleting test:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete test',
      },
      { status: 500 }
    )
  }
}
