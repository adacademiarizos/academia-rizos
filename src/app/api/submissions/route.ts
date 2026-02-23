/**
 * POST /api/submissions
 * Submit test answers (with optional evidence files)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { db } from '@/lib/db'
import { submitTestSchema } from '@/validators/academy'
import { CourseService } from '@/server/services/course-service'

export async function POST(request: NextRequest) {
  try {
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

    // Parse and validate request
    const body = await request.json()
    const validation = submitTestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { testId, courseId, answers, evidence } = validation.data

    // Verify course access
    const access = await CourseService.checkUserAccess(user.id, courseId)

    if (!access.hasAccess) {
      return NextResponse.json(
        { success: false, error: 'No access to this course' },
        { status: 403 }
      )
    }

    // Verify test exists and belongs to course
    const test = await db.test.findUnique({
      where: { id: testId },
      select: { courseId: true },
    })

    if (!test || test.courseId !== courseId) {
      return NextResponse.json(
        { success: false, error: 'Invalid test' },
        { status: 400 }
      )
    }

    // Check if user already has a non-approved submission
    const existingSubmission = await db.submission.findUnique({
      where: {
        testId_userId: { testId, userId: user.id },
      },
      select: { status: true },
    })

    if (existingSubmission && existingSubmission.status === 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Already approved for this test. Cannot resubmit.',
        },
        { status: 400 }
      )
    }

    // Create or update submission
    const submission = await db.submission.upsert({
      where: {
        testId_userId: { testId, userId: user.id },
      },
      update: {
        answersJson: answers,
        evidenceJson: evidence && evidence.length > 0 ? evidence : undefined,
        status: 'PENDING',
      },
      create: {
        testId,
        userId: user.id,
        answersJson: answers,
        evidenceJson: evidence && evidence.length > 0 ? evidence : undefined,
        status: 'PENDING',
      },
    })

    // TODO: Send email to admin about new submission

    return NextResponse.json(
      {
        success: true,
        data: {
          id: submission.id,
          status: submission.status,
          message: 'Submission received. Admin will review shortly.',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error submitting test:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to submit test' },
      { status: 500 }
    )
  }
}
