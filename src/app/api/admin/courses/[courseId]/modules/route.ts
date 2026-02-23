/**
 * GET /api/admin/courses/[courseId]/modules - Get all modules for a course (requires ADMIN)
 * POST /api/admin/courses/[courseId]/modules - Create module (requires ADMIN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const CreateModuleSchema = z.object({
  order: z.number().int().positive('Order must be a positive number'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  videoUrl: z.string().url().optional().or(z.literal('')),
  videoFileUrl: z.string().url().optional().or(z.literal('')),
  transcript: z.string().optional(),
  resources: z.array(z.object({
    title: z.string().min(1),
    fileUrl: z.string().url(),
    fileType: z.string(),
    fileSize: z.number().int().min(0),
  })).optional(),
})

async function verifyAdmin() {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return false
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })

  return user?.role === 'ADMIN'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params

    // Check admin
    if (!(await verifyAdmin())) {
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

    // Get all modules for the course
    const modules = await db.module.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: modules,
    })
  } catch (error) {
    console.error('Error fetching modules:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch modules',
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
    if (!(await verifyAdmin())) {
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
    const data = CreateModuleSchema.parse(body)

    // Create module
    const module = await db.module.create({
      data: {
        courseId,
        order: data.order,
        title: data.title,
        description: data.description || null,
        videoUrl: data.videoUrl || null,
        videoFileUrl: data.videoFileUrl || null,
        transcript: data.transcript || null,
      },
    })

    // Create any resources passed at creation time (temp-uploaded files)
    if (data.resources && data.resources.length > 0) {
      await db.moduleResource.createMany({
        data: data.resources.map((r, i) => ({
          moduleId: module.id,
          title: r.title,
          fileUrl: r.fileUrl,
          fileType: r.fileType,
          fileSize: r.fileSize,
          order: i,
        })),
      })
    }

    return NextResponse.json(
      {
        success: true,
        data: module,
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

    console.error('Error creating module:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create module',
      },
      { status: 500 }
    )
  }
}
