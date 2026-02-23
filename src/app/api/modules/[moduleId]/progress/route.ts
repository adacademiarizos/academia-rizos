/**
 * POST /api/modules/[moduleId]/progress
 * Mark a module as completed for the current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params

    if (!moduleId) {
      return NextResponse.json(
        { success: false, error: 'Module ID is required' },
        { status: 400 }
      )
    }

    // Verify user is authenticated
    const session = await getServerSession()

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user
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

    // Get module and verify it exists
    const module = await db.module.findUnique({
      where: { id: moduleId },
      select: { id: true, courseId: true },
    })

    if (!module) {
      return NextResponse.json(
        { success: false, error: 'Module not found' },
        { status: 404 }
      )
    }

    // Verify user has access to the course
    const courseAccess = await db.courseAccess.findUnique({
      where: {
        userId_courseId: { userId: user.id, courseId: module.courseId },
      },
      select: { accessUntil: true },
    })

    if (!courseAccess) {
      return NextResponse.json(
        { success: false, error: 'No access to this course' },
        { status: 403 }
      )
    }

    // Check if access is expired
    if (courseAccess.accessUntil && courseAccess.accessUntil < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Course access has expired' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { completed } = body

    if (typeof completed !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Completed must be a boolean' },
        { status: 400 }
      )
    }

    // Upsert module progress
    const progress = await db.moduleProgress.upsert({
      where: {
        userId_moduleId: { userId: user.id, moduleId },
      },
      update: {
        completed,
        completedAt: completed ? new Date() : null,
      },
      create: {
        userId: user.id,
        moduleId,
        completed,
        completedAt: completed ? new Date() : null,
      },
    })

    return NextResponse.json({
      success: true,
      data: progress,
    })
  } catch (error) {
    console.error('Error updating module progress:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update progress' },
      { status: 500 }
    )
  }
}
