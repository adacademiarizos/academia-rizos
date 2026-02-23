/**
 * GET /api/admin/courses - List all courses (requires ADMIN)
 * POST /api/admin/courses - Create new course (requires ADMIN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const CreateCourseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  trailerUrl: z.string().url().optional().or(z.literal('')),
  priceCents: z.number().int().min(0, 'Price must be non-negative'),
  rentalDays: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin role
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering/pagination
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const isActive = searchParams.get('isActive')

    const where: any = {}
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // Fetch courses with stats
    const [courses, total] = await Promise.all([
      db.course.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          priceCents: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              modules: true,
              access: true,
          },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.course.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: courses.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        priceCents: c.priceCents,
        isActive: c.isActive,
        createdAt: c.createdAt,
        moduleCount: c._count.modules,
        enrolledCount: c._count.access,
      })),
      total,
      count: courses.length,
    })
  } catch (error) {
    console.error('Error fetching courses:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch courses',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin role
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = CreateCourseSchema.parse(body)

    // Create course
    const course = await db.course.create({
      data: {
        title: data.title,
        description: data.description,
        trailerUrl: data.trailerUrl || null,
        priceCents: data.priceCents,
        rentalDays: data.rentalDays || null,
        isActive: data.isActive,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: course,
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

    console.error('Error creating course:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create course',
      },
      { status: 500 }
    )
  }
}
