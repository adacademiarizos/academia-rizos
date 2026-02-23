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

    return NextResponse.json({ success: true, data: lessons })
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
