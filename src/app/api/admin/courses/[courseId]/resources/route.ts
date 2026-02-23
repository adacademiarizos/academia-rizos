/**
 * GET /api/admin/courses/[courseId]/resources - Get all resources for a course
 * POST /api/admin/courses/[courseId]/resources - Create a new resource
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const CreateResourceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  fileUrl: z.string().url('Invalid file URL'),
  fileType: z.enum(['pdf', 'image', 'document', 'other']),
  fileSize: z.number().int().min(0),
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

    // Get all resources for the course
    const resources = await db.courseResource.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: resources,
    })
  } catch (error) {
    console.error('Error fetching resources:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch resources',
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

    const body = await request.json()
    const data = CreateResourceSchema.parse(body)

    // Get the next order number
    const lastResource = await db.courseResource.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
    })

    const nextOrder = (lastResource?.order ?? -1) + 1

    // Create resource
    const resource = await db.courseResource.create({
      data: {
        courseId,
        title: data.title,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
        order: nextOrder,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: resource,
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

    console.error('Error creating resource:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create resource',
      },
      { status: 500 }
    )
  }
}
