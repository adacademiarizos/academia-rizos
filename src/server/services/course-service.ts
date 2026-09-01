/**
 * Course Service - Business logic for academy courses
 */

import { db } from '@/lib/db'
import { addStripeFees } from '@/lib/fees'
import type { Prisma } from '@prisma/client'

type CourseAccessClient = Pick<Prisma.TransactionClient, 'course' | 'courseAccess'>

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
              styles: true,
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
        contentStructure: course.contentStructure,
        moduleCount: course._count.modules + course._count.styles,
        totalHours: ((course._count.modules + course._count.styles) * 1.5),
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
            where: { styleId: null },
            select: {
              id: true,
              order: true,
              title: true,
              description: true,
            },
            orderBy: { order: 'asc' },
          },
          styles: {
            select: {
              id: true,
              order: true,
              name: true,
              description: true,
            },
            orderBy: { order: 'asc' },
          },
          _count: {
            select: {
              modules: true,
              styles: true,
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

    const totalModules = course._count.modules + course._count.styles
    const totalHours = totalModules * 1.5

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      learningOutcomes: course.learningOutcomes,
      trailerUrl: course.trailerUrl,
      thumbnailUrl: course.thumbnailUrl,
      priceCents: course.priceCents,
      totalPriceCents: totalCents,
      feeCents,
      currency: course.currency,
      rentalDays: course.rentalDays,
      isActive: course.isActive,
      contentStructure: course.contentStructure,
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
      where: { courseId, styleId: null },
      select: {
        id: true,
        order: true,
        title: true,
        description: true,
        videoFileUrl: true,
        lessons: { where: { styleId: null }, select: { id: true } },
      },
      orderBy: { order: 'asc' },
    })

    if (!userId) {
      return modules.map(({ lessons, ...module }) => {
        void lessons
        return module
      })
    }

    // Derived from LessonProgress, the same source the styles use and the same
    // one that gates the final exam. Reading the separate ModuleProgress table
    // let a module show as completed while every lesson in it was still
    // pending, so the course page and the exam gate disagreed.
    const progress = await db.lessonProgress.findMany({
      where: { userId, lesson: { courseId, moduleId: { not: null } } },
      select: { lessonId: true, completed: true },
    })
    const completedLessonIds = new Set(
      progress.filter((item) => item.completed).map((item) => item.lessonId)
    )

    return modules.map(({ lessons, ...module }) => ({
      ...module,
      completed: lessons.length > 0 && lessons.every((lesson) => completedLessonIds.has(lesson.id)),
    }))
  }

  /**
   * Get the course-level style sections and their completion state. Styles are
   * independent from modules and complete when all their direct lessons do.
   */
  static async getCourseStyles(courseId: string, userId?: string) {
    const course = await db.course.findUnique({ where: { id: courseId }, select: { contentStructure: true } })
    if (!course || (course.contentStructure !== 'STYLES' && course.contentStructure !== 'BOTH')) {
      return []
    }

    const styles = await db.moduleStyle.findMany({
      where: { courseId },
      select: {
        id: true,
        order: true,
        name: true,
        description: true,
        _count: { select: { lessons: { where: { moduleId: null } } } },
        lessons: { where: { moduleId: null }, select: { id: true } },
      },
      orderBy: { order: 'asc' },
    })

    if (!userId) {
      return styles.map((style) => ({
        id: style.id,
        order: style.order,
        name: style.name,
        description: style.description,
        lessonCount: style._count.lessons,
      }))
    }

    const progress = await db.lessonProgress.findMany({
      where: { userId, lesson: { courseId, moduleId: null } },
      select: { lessonId: true, completed: true },
    })
    const completedLessonIds = new Set(
      progress.filter((item) => item.completed).map((item) => item.lessonId)
    )

    return styles.map(({ lessons, _count, ...style }) => ({
      ...style,
      lessonCount: _count.lessons,
      completed: lessons.length > 0 && lessons.every((lesson) => completedLessonIds.has(lesson.id)),
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
    const [modules, styles] = await Promise.all([
      this.getCourseModules(courseId, userId),
      this.getCourseStyles(courseId, userId),
    ])
    const moduleCount = modules.length + styles.length

    // Get completed modules
    const completedCount = [
      ...modules.filter((module) => 'completed' in module && module.completed),
      ...styles.filter((style) => 'completed' in style && style.completed),
    ].length

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
  static async createCourseAccess(userId: string, courseId: string, client: CourseAccessClient = db) {
    // Check course exists
    const course = await client.course.findUnique({
      where: { id: courseId },
      select: { rentalDays: true },
    })

    if (!course) {
      throw new Error('Course not found')
    }

    // Check if already has access
    const existing = await client.courseAccess.findUnique({
      where: { userId_courseId: { userId, courseId } },
    })

    if (existing && !existing.accessUntil && !existing.revokedAt) {
      // Already has lifetime access
      return existing
    }

    if (existing) {
      // Extend access. Paying again also lifts an earlier revocation —
      // otherwise a refunded student could never re-purchase the course.
      const newAccessUntil = course.rentalDays
        ? new Date(Date.now() + course.rentalDays * 24 * 60 * 60 * 1000)
        : null

      return client.courseAccess.update({
        where: { id: existing.id },
        data: { accessUntil: newAccessUntil, revokedAt: null },
      })
    }

    // Create new access
    const accessUntil = course.rentalDays
      ? new Date(Date.now() + course.rentalDays * 24 * 60 * 60 * 1000)
      : null

    return client.courseAccess.create({
      data: {
        userId,
        courseId,
        accessUntil,
      },
    })
  }

  /**
   * Revoke course access (after a refund or chargeback).
   *
   * Idempotent by design: webhooks retry, and matching only rows that are not
   * revoked yet keeps the original revocation timestamp instead of pushing it
   * forward on every replay. A missing row is a no-op rather than a throw.
   */
  static async revokeCourseAccess(userId: string, courseId: string, client: CourseAccessClient = db) {
    return client.courseAccess.updateMany({
      where: { userId, courseId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
}
