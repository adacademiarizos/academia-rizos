/**
 * Course Service - Business logic for academy courses
 */

import { db } from '@/lib/db'
import { addStripeFees } from '@/lib/fees'
import type { Course, Module } from '@prisma/client'

export class CourseService {
  /**
   * Get all active courses with metadata
   */
  static async getAllCourses() {
    const [courses, settings] = await Promise.all([
      db.course.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              modules: true,
              resources: true,
              access: true,
            },
          },
          test: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.settings.findUnique({ where: { id: 'global' } }),
    ])

    const feePercent = settings?.feePercent ?? 2.5
    const feeFixedCents = settings?.feeFixedCents ?? 25

    return courses.map((course) => {
      const { totalCents, feeCents } = addStripeFees({
        baseCents: course.priceCents,
        feePercent,
        feeFixedCents,
      })
      return {
        id: course.id,
        title: course.title,
        description: course.description,
        trailerUrl: course.trailerUrl,
        thumbnailUrl: course.thumbnailUrl,
        priceCents: course.priceCents,
        totalPriceCents: totalCents,
        feeCents,
        currency: course.currency,
        rentalDays: course.rentalDays,
        isActive: course.isActive,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
        moduleCount: course._count.modules,
        totalHours: (course._count.modules * 1.5),
        hasTest: !!course.test,
      }
    })
  }

  /**
   * Get single course with full details
   */
  static async getCourseById(courseId: string) {
    const [course, settings] = await Promise.all([
      db.course.findUnique({
        where: { id: courseId },
        include: {
          modules: {
            select: {
              id: true,
              order: true,
              title: true,
              description: true,
            },
            orderBy: { order: 'asc' },
          },
          _count: {
            select: {
              modules: true,
              resources: true,
              access: true,
            },
          },
          test: {
            select: { id: true },
          },
        },
      }),
      db.settings.findUnique({ where: { id: 'global' } }),
    ])

    if (!course) {
      throw new Error('Course not found')
    }

    const feePercent = settings?.feePercent ?? 2.5
    const feeFixedCents = settings?.feeFixedCents ?? 25
    const { totalCents, feeCents } = addStripeFees({
      baseCents: course.priceCents,
      feePercent,
      feeFixedCents,
    })

    const totalModules = course._count.modules
    const totalHours = totalModules * 1.5

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      trailerUrl: course.trailerUrl,
      thumbnailUrl: course.thumbnailUrl,
      priceCents: course.priceCents,
      totalPriceCents: totalCents,
      feeCents,
      currency: course.currency,
      rentalDays: course.rentalDays,
      isActive: course.isActive,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      moduleCount: totalModules,
      totalHours,
      hasTest: !!course.test,
    }
  }

  /**
   * Check if user has access to a course
   */
  static async checkUserAccess(userId: string, courseId: string) {
    const access = await db.courseAccess.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
      select: {
        id: true,
        accessUntil: true,
      },
    })

    if (!access) {
      return { hasAccess: false, isExpired: false, canWatchVideos: false }
    }

    // Check if video rental period has expired
    const isExpired = !!(access.accessUntil && access.accessUntil < new Date())

    return {
      hasAccess: true,          // purchased — always true once enrolled
      isExpired,
      canWatchVideos: !isExpired, // false only when rentalDays has passed
      accessUntil: access.accessUntil,
    }
  }

  /**
   * Get course modules with progress
   */
  static async getCourseModules(courseId: string, userId?: string) {
    const modules = await db.module.findMany({
      where: { courseId },
      select: {
        id: true,
        order: true,
        title: true,
        description: true,
        videoUrl: true,
      },
      orderBy: { order: 'asc' },
    })

    if (!userId) {
      return modules
    }

    // Get progress for user
    const progress = await db.moduleProgress.findMany({
      where: { userId },
      select: { moduleId: true, completed: true },
    })

    const progressMap = new Map(progress.map((p) => [p.moduleId, p.completed]))

    return modules.map((module) => ({
      ...module,
      completed: progressMap.get(module.id) || false,
    }))
  }

  /**
   * Get course resources
   */
  static async getCourseResources(courseId: string) {
    const resources = await db.resource.findMany({
      where: { courseId },
      select: {
        id: true,
        type: true,
        fileName: true,
        fileUrl: true,
      },
    })

    return resources
  }

  /**
   * Get course test schema
   */
  static async getCourseTest(courseId: string) {
    const test = await db.test.findUnique({
      where: { courseId },
      select: {
        id: true,
        schemaJson: true,
      },
    })

    if (!test) {
      throw new Error('Test not found for this course')
    }

    return test
  }

  /**
   * Get student progress in course
   */
  static async getStudentCourseProgress(userId: string, courseId: string) {
    // Check access first
    const access = await this.checkUserAccess(userId, courseId)
    if (!access.hasAccess) {
      throw new Error('No access to this course')
    }

    // Get module count
    const moduleCount = await db.module.count({
      where: { courseId },
    })

    // Get completed modules
    const completedCount = await db.moduleProgress.count({
      where: { userId, module: { courseId } },
    })

    // Get submission status
    const test = await db.test.findUnique({
      where: { courseId },
    })

    let submissionStatus: 'LOCKED' | 'AVAILABLE' | 'COMPLETED' | 'PENDING_REVIEW' | 'APPROVED' =
      'LOCKED'
    let certificate = null

    if (test) {
      const isAllModulesComplete = completedCount === moduleCount && moduleCount > 0

      if (isAllModulesComplete) {
        // Check submission status
        const submission = await db.submission.findUnique({
          where: { testId_userId: { testId: test.id, userId } },
          select: {
            id: true,
            status: true,
            certificate: {
              select: { id: true, code: true, pdfUrl: true },
            },
          },
        })

        if (!submission) {
          submissionStatus = 'AVAILABLE'
        } else if (submission.status === 'APPROVED') {
          submissionStatus = 'APPROVED'
          certificate = submission.certificate
        } else if (submission.status === 'PENDING') {
          submissionStatus = 'PENDING_REVIEW'
        } else if (submission.status === 'REVISION_REQUESTED') {
          submissionStatus = 'AVAILABLE' // Can retake
        }
      }
    }

    return {
      moduleCount,
      completedCount,
      percentComplete: moduleCount > 0 ? Math.round((completedCount / moduleCount) * 100) : 0,
      submissionStatus,
      certificate,
      accessUntil: access.accessUntil,
    }
  }

  /**
   * Create course access (after purchase)
   */
  static async createCourseAccess(userId: string, courseId: string) {
    // Check course exists
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { rentalDays: true },
    })

    if (!course) {
      throw new Error('Course not found')
    }

    // Check if already has access
    const existing = await db.courseAccess.findUnique({
      where: { userId_courseId: { userId, courseId } },
    })

    if (existing && !existing.accessUntil) {
      // Already has lifetime access
      return existing
    }

    if (existing) {
      // Extend access
      const newAccessUntil = course.rentalDays
        ? new Date(Date.now() + course.rentalDays * 24 * 60 * 60 * 1000)
        : null

      return db.courseAccess.update({
        where: { id: existing.id },
        data: { accessUntil: newAccessUntil },
      })
    }

    // Create new access
    const accessUntil = course.rentalDays
      ? new Date(Date.now() + course.rentalDays * 24 * 60 * 60 * 1000)
      : null

    return db.courseAccess.create({
      data: {
        userId,
        courseId,
        accessUntil,
      },
    })
  }
}
