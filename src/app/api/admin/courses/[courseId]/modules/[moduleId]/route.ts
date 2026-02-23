/**
 * PUT /api/admin/courses/[courseId]/modules/[moduleId] - Update module (requires ADMIN)
 * DELETE /api/admin/courses/[courseId]/modules/[moduleId] - Delete module (requires ADMIN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const UpdateModuleSchema = z.object({
  order: z.number().int().positive().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  videoUrl: z.string().url().optional().or(z.literal('')),
  transcript: z.string().optional(),
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> }
) {
  try {
    const { courseId, moduleId } = await params

    // Check admin
    if (!(await verifyAdmin())) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify module exists and belongs to course
    const module = await db.module.findUnique({
      where: { id: moduleId },
    })

    if (!module || module.courseId !== courseId) {
      return NextResponse.json(
        { success: false, error: 'Module not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = UpdateModuleSchema.parse(body)

    // Update module
    const updated = await db.module.update({
      where: { id: moduleId },
      data: {
        ...(data.order !== undefined && { order: data.order }),
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl || null }),
        ...(data.transcript !== undefined && { transcript: data.transcript || null }),
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

    console.error('Error updating module:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update module',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> }
) {
  try {
    const { courseId, moduleId } = await params

    // Check admin
    if (!(await verifyAdmin())) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify module exists and belongs to course
    const module = await db.module.findUnique({
      where: { id: moduleId },
    })

    if (!module || module.courseId !== courseId) {
      return NextResponse.json(
        { success: false, error: 'Module not found' },
        { status: 404 }
      )
    }

    // Delete module
    const deleted = await db.module.delete({
      where: { id: moduleId },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: deleted.id,
        title: deleted.title,
        message: 'Module deleted successfully',
      },
    })
  } catch (error) {
    console.error('Error deleting module:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete module',
      },
      { status: 500 }
    )
  }
}
