/**
 * GET /api/admin/modules/[moduleId]/tests - Get all tests for a module
 * POST /api/admin/modules/[moduleId]/tests - Create a new test
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const CreateTestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  isRequired: z.boolean().default(false),
  maxAttempts: z.number().int().min(0).default(1),
  passingScore: z.number().int().min(0).max(100).default(70),
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
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params

    // Check admin
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify module exists
    const module = await db.module.findUnique({
      where: { id: moduleId },
    })

    if (!module) {
      return NextResponse.json(
        { success: false, error: 'Module not found' },
        { status: 404 }
      )
    }

    // Get all tests for the module with question count
    const tests = await db.moduleTest.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { questions: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: tests.map((test) => ({
        ...test,
        questionCount: test._count.questions,
      })),
    })
  } catch (error) {
    console.error('Error fetching tests:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tests',
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params

    // Check admin
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify module exists
    const module = await db.module.findUnique({
      where: { id: moduleId },
    })

    if (!module) {
      return NextResponse.json(
        { success: false, error: 'Module not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = CreateTestSchema.parse(body)

    // Get the next order number
    const lastTest = await db.moduleTest.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' },
    })

    const nextOrder = (lastTest?.order ?? -1) + 1

    // Create test
    const test = await db.moduleTest.create({
      data: {
        moduleId,
        title: data.title,
        description: data.description || null,
        isRequired: data.isRequired,
        maxAttempts: data.maxAttempts,
        passingScore: data.passingScore,
        order: nextOrder,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: test,
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

    console.error('Error creating test:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create test',
      },
      { status: 500 }
    )
  }
}
