/**
 * GET /api/admin/courses/[courseId]/exam - Get course exam
 * POST /api/admin/courses/[courseId]/exam - Create/initialize course exam
 * PUT /api/admin/courses/[courseId]/exam - Update exam settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const CreateExamSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
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

    // Verify course exists
    const course = await db.course.findUnique({
      where: { id: courseId },
    })

    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      )
    }

    // Get exam if it exists
    const exam = await db.courseExam.findUnique({
      where: { courseId },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    })

    if (!exam) {
      return NextResponse.json({
        success: true,
        data: null,
      })
    }

    return NextResponse.json({
      success: true,
      data: exam,
    })
  } catch (error) {
    console.error('Error fetching exam:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch exam',
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

    // Verify course exists
    const course = await db.course.findUnique({
      where: { id: courseId },
    })

    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      )
    }

    // Check if exam already exists
    const existingExam = await db.courseExam.findUnique({
      where: { courseId },
    })

    if (existingExam) {
      return NextResponse.json(
        { success: false, error: 'Exam already exists for this course' },
        { status: 409 }
      )
    }

    const body = await request.json()
    const data = CreateExamSchema.parse(body)

    // Create exam
    const exam = await db.courseExam.create({
      data: {
        courseId,
        title: data.title || 'Final Exam',
        description: data.description || null,
        passingScore: data.passingScore || 70,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: exam,
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

    console.error('Error creating exam:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create exam',
      },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const data = CreateExamSchema.parse(body)

    // Update exam
    const updated = await db.courseExam.update({
      where: { courseId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description || null }),
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

    console.error('Error updating exam:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update exam',
      },
      { status: 500 }
    )
  }
}
