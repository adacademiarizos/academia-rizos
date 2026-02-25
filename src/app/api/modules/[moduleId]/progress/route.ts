/**
 * POST /api/modules/[moduleId]/progress
 * Mark a module as completed for the current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { db } from '@/lib/db'

/**
 * Creates a pending certificate record when all modules are complete and there is no final exam.
 * The admin will see this in the certificates panel and can approve/generate the PDF.
 */
async function autoCreatePendingCertificate(userId: string, courseId: string) {
  // Count total published modules in the course
  const totalModules = await db.module.count({ where: { courseId } })
  if (totalModules === 0) return

  // Count how many this user has completed
  const completedCount = await db.moduleProgress.count({
    where: { userId, module: { courseId }, completed: true },
  })
  if (completedCount < totalModules) return

  // Check if the course has a final exam (CourseTest or legacy CourseExam)
  const [finalExamCount, legacyExamCount] = await Promise.all([
    db.courseTest.count({ where: { courseId, isFinalExam: true } }),
    db.courseExam.count({ where: { courseId } }),
  ])
  if (finalExamCount > 0 || legacyExamCount > 0) return

  // Skip if a certificate already exists for this user+course
  const existing = await db.certificate.findFirst({ where: { userId, courseId } })
  if (existing) return

  // Create a pending certificate (valid=false, pdfUrl=null = pending approval)
  const certCode = `PEND-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  await db.certificate.create({
    data: {
      code: certCode,
      courseId,
      userId,
      valid: false,
      pdfUrl: null,
    },
  })
}

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

    // Verify user has access to the course (purchased, regardless of rental expiry)
    const courseAccess = await db.courseAccess.findUnique({
      where: {
        userId_courseId: { userId: user.id, courseId: module.courseId },
      },
      select: { id: true },
    })

    if (!courseAccess) {
      return NextResponse.json(
        { success: false, error: 'No access to this course' },
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

    // Gate: if marking complete, check all required tests are passed
    if (completed) {
      const requiredTests = await db.moduleTest.findMany({
        where: { moduleId, isRequired: true },
        select: { id: true, title: true },
      })

      if (requiredTests.length > 0) {
        const passedSubmissions = await db.moduleSubmission.findMany({
          where: {
            userId: user.id,
            testId: { in: requiredTests.map((t) => t.id) },
            isPassed: true,
          },
          select: { testId: true },
        })
        const passedIds = new Set(passedSubmissions.map((s) => s.testId))
        const failingTests = requiredTests.filter((t) => !passedIds.has(t.id))

        if (failingTests.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'REQUIRED_TESTS_PENDING',
              failingTests: failingTests.map((t) => ({ id: t.id, title: t.title })),
            },
            { status: 403 }
          )
        }
      }
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

    // Fire-and-forget: if marking as complete, check if a pending certificate request should be created
    if (completed) {
      autoCreatePendingCertificate(user.id, module.courseId).catch((err) => {
        console.error('Auto-certificate check failed:', err)
      })
    }

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
