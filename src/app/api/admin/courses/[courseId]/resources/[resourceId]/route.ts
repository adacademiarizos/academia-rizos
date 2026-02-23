/**
 * PUT /api/admin/courses/[courseId]/resources/[resourceId] - Update/reorder resource
 * DELETE /api/admin/courses/[courseId]/resources/[resourceId] - Delete resource
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { deleteFile } from '@/lib/storage'

const UpdateResourceSchema = z.object({
  order: z.number().int().min(0).optional(),
  title: z.string().min(1).optional(),
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
  }: { params: Promise<{ courseId: string; resourceId: string }> }
) {
  try {
    const { courseId, resourceId } = await params

    // Check admin
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify resource exists and belongs to course
    const resource = await db.courseResource.findUnique({
      where: { id: resourceId },
    })

    if (!resource || resource.courseId !== courseId) {
      return NextResponse.json(
        { success: false, error: 'Resource not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = UpdateResourceSchema.parse(body)

    // Update resource
    const updated = await db.courseResource.update({
      where: { id: resourceId },
      data: {
        ...(data.order !== undefined && { order: data.order }),
        ...(data.title && { title: data.title }),
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

    console.error('Error updating resource:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update resource',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ courseId: string; resourceId: string }> }
) {
  try {
    const { courseId, resourceId } = await params

    // Check admin
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify resource exists and belongs to course
    const resource = await db.courseResource.findUnique({
      where: { id: resourceId },
    })

    if (!resource || resource.courseId !== courseId) {
      return NextResponse.json(
        { success: false, error: 'Resource not found' },
        { status: 404 }
      )
    }

    // Delete from S3/R2
    try {
      const fileKey = resource.fileUrl.split('/').slice(-2).join('/')
      await deleteFile(fileKey)
    } catch (err) {
      console.error('Failed to delete file from storage:', err)
      // Continue anyway - delete database record
    }

    // Delete resource from database
    const deleted = await db.courseResource.delete({
      where: { id: resourceId },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: deleted.id,
        title: deleted.title,
        message: 'Resource deleted successfully',
      },
    })
  } catch (error) {
    console.error('Error deleting resource:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete resource',
      },
      { status: 500 }
    )
  }
}
