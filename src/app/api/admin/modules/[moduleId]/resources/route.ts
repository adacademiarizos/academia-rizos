/**
 * GET /api/admin/modules/[moduleId]/resources - Get all resources for a module
 * POST /api/admin/modules/[moduleId]/resources - Create a new resource (just reference an uploaded file)
 * PUT /api/admin/modules/[moduleId]/resources/[resourceId] - Reorder resources
 * DELETE /api/admin/modules/[moduleId]/resources/[resourceId] - Delete resource
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

const UpdateResourceOrderSchema = z.object({
  order: z.number().int().min(0),
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

    // Get all resources for the module
    const resources = await db.moduleResource.findMany({
      where: { moduleId },
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
    const data = CreateResourceSchema.parse(body)

    // Get the next order number
    const lastResource = await db.moduleResource.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' },
    })

    const nextOrder = (lastResource?.order ?? -1) + 1

    // Create resource
    const resource = await db.moduleResource.create({
      data: {
        moduleId,
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
