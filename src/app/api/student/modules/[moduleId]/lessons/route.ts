/**
 * GET /api/student/modules/[moduleId]/lessons
 * Returns all lessons for a module (for students)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const { moduleId } = await params

    // Resolve the course this module belongs to
    const module = await db.module.findUnique({
      where: { id: moduleId },
      select: { courseId: true },
    })

    if (!module) {
      return NextResponse.json(
        { success: false, error: 'Module not found' },
        { status: 404 }
      )
    }

    // Check course access and whether the video rental period is still active
    const access = await db.courseAccess.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: module.courseId } },
      select: { accessUntil: true },
    })

    if (!access) {
      return NextResponse.json(
        { success: false, error: 'No access to this course' },
        { status: 403 }
      )
    }

    const videoExpired = !!(access.accessUntil && access.accessUntil < new Date())

    const lessons = await db.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        order: true,
        title: true,
        description: true,
        videoUrl: true,
        videoFileUrl: true,
        transcript: true,
      },
    })

    // If the video rental period has expired, strip video URLs but keep metadata
    const data = videoExpired
      ? lessons.map((l) => ({ ...l, videoUrl: null, videoFileUrl: null }))
      : lessons

    return NextResponse.json({
      success: true,
      data,
      videoExpired,
    })
  } catch (error) {
    console.error('Error fetching lessons:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch lessons',
      },
      { status: 500 }
    )
  }
}

