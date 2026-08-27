/**
 * PUT /api/admin/courses/[courseId]/modules/[moduleId] - Update module (requires ADMIN)
 * DELETE /api/admin/courses/[courseId]/modules/[moduleId] - Delete module (requires ADMIN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const UpdateModuleSchema = z.object({
  order: z.number().int().positive().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  videoFileUrl: z.string().url().optional().or(z.literal('')),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> }
) {
  try {
    const { courseId, moduleId } = await params

    // Check admin
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    // Verify module exists and belongs to course
    const mod = await db.module.findUnique({
      where: { id: moduleId },
    })

    if (!mod || mod.courseId !== courseId) {
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
        ...(data.videoFileUrl !== undefined && { videoFileUrl: data.videoFileUrl || null }),
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
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    // Verify module exists and belongs to course
    const mod = await db.module.findUnique({
      where: { id: moduleId },
    })

    if (!mod || mod.courseId !== courseId) {
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
