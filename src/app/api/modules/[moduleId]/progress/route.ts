/**
 * POST /api/modules/[moduleId]/progress
 * Mark a module as completed for the current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByModuleId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'
import { NotificationService } from '@/server/services/notification-service'

async function autoCreatePendingCertificate(userId: string, courseId: string) {
  const totalModules = await db.module.count({ where: { courseId } })
  if (totalModules === 0) return

  const completedCount = await db.moduleProgress.count({
    where: { userId, module: { courseId }, completed: true },
  })
  if (completedCount < totalModules) return

  const [finalExamCount, legacyExamCount] = await Promise.all([
    db.courseTest.count({ where: { courseId, isFinalExam: true } }),
    db.courseExam.count({ where: { courseId } }),
  ])
  if (finalExamCount > 0 || legacyExamCount > 0) return

  const existing = await db.certificate.findFirst({ where: { userId, courseId } })
  if (existing) return

  const certCode = `PEND-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const certificate = await db.certificate.create({
    data: {
      code: certCode,
      courseId,
      userId,
      valid: false,
      pdfUrl: null,
    },
  })

  await NotificationService.triggerOnCertificatePendingReview({
    certificateId: certificate.id,
    userId,
    courseId,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params

    if (!moduleId) {
      return NextResponse.json({ success: false, error: 'Module ID is required' }, { status: 400 })
    }

    const access = await authorizeCourseAccessByModuleId(moduleId, {
      allowAdmin: false,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    const body = await request.json()
    const { completed } = body

    if (typeof completed !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Completed must be a boolean' }, { status: 400 })
    }

    if (completed) {
      const requiredTests = await db.moduleTest.findMany({
        where: { moduleId, isRequired: true },
        select: { id: true, title: true },
      })

      if (requiredTests.length > 0) {
        const passedSubmissions = await db.moduleSubmission.findMany({
          where: {
            userId: access.user.id,
            testId: { in: requiredTests.map((test) => test.id) },
            isPassed: true,
          },
          select: { testId: true },
        })
        const passedIds = new Set(passedSubmissions.map((submission) => submission.testId))
        const failingTests = requiredTests.filter((test) => !passedIds.has(test.id))

        if (failingTests.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'REQUIRED_TESTS_PENDING',
              failingTests: failingTests.map((test) => ({ id: test.id, title: test.title })),
            },
            { status: 403 }
          )
        }
      }
    }

    const progress = await db.moduleProgress.upsert({
      where: {
        userId_moduleId: { userId: access.user.id, moduleId },
      },
      update: {
        completed,
        completedAt: completed ? new Date() : null,
      },
      create: {
        userId: access.user.id,
        moduleId,
        completed,
        completedAt: completed ? new Date() : null,
      },
    })

    if (completed) {
      await autoCreatePendingCertificate(access.user.id, access.courseId).catch((error) => {
        console.error('Auto-certificate check failed:', error)
      })
      // A module is only an intermediate milestone. The final exam/certificate
      // workflow is the sole owner of COURSE_COMPLETION notifications.
    }

    return NextResponse.json({
      success: true,
      data: progress,
    })
  } catch (error) {
    console.error('Error updating progress:', error)
    return NextResponse.json({ success: false, error: 'Failed to update progress' }, { status: 500 })
  }
}
