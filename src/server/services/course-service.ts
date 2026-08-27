/**
 * Course Service - Business logic for academy courses
 */

import { db } from '@/lib/db'
import { addStripeFees } from '@/lib/fees'
import { buildActiveCourseAccessWhere, isCourseAccessActive } from '@/lib/course-access'
import { cancelScheduledNotificationDeliveries } from '@/server/services/notification-dispatcher'
import { NotificationEventService } from '@/server/services/notification-event-service'
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
        revokedAt: true,
      },
    })

    if (!access || access.revokedAt) {
      return { hasAccess: false, isExpired: false, canWatchVideos: false }
    }

    // Check if video rental period has expired
    const isExpired = !isCourseAccessActive(access)

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

    // Lesson progress is canonical. A module is complete only when all of its
    // lessons are complete; module-level progress remains historical data.
    const lessons = await db.lesson.findMany({
      where: { moduleId: { in: modules.map((module) => module.id) } },
      select: { id: true, moduleId: true },
    })
    const completedLessons = await db.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessons.map((lesson) => lesson.id) } },
      select: { lessonId: true },
    })
    const completedLessonIds = new Set(completedLessons.map((progress) => progress.lessonId))
    const lessonsByModule = new Map<string, string[]>()
    for (const lesson of lessons) {
      lessonsByModule.set(lesson.moduleId, [...(lessonsByModule.get(lesson.moduleId) ?? []), lesson.id])
    }

    return modules.map((module) => {
      const moduleLessons = lessonsByModule.get(module.id) ?? []
      return {
        ...module,
        lessonCount: moduleLessons.length,
        completedLessonCount: moduleLessons.filter((lessonId) => completedLessonIds.has(lessonId)).length,
        completed: moduleLessons.length > 0 && moduleLessons.every((lessonId) => completedLessonIds.has(lessonId)),
      }
    })
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
  static async createCourseAccess(userId: string, courseId: string, client: CourseAccessClient = db) {
    // Check course exists
    const course = await client.course.findUnique({
      where: { id: courseId },
      select: { rentalDays: true, title: true },
    })

    if (!course) {
      throw new Error('Course not found')
    }

    // Check if already has access
    const existing = await client.courseAccess.findUnique({
      where: { userId_courseId: { userId, courseId } },
    })

    if (existing && !existing.revokedAt && !existing.accessUntil) {
      // Already has lifetime access
      return existing
    }

    if (existing) {
      // Extend access
      const newAccessUntil = course.rentalDays
        ? new Date(Date.now() + course.rentalDays * 24 * 60 * 60 * 1000)
        : null

      await cancelScheduledNotificationDeliveries({
        resource: { type: 'COURSE_ACCESS', id: existing.id },
      })

      const access = await client.courseAccess.update({
        where: { id: existing.id },
        data: {
          accessUntil: newAccessUntil,
          revokedAt: null,
        },
      })
      await NotificationEventService.courseAccessGranted({
        accessId: access.id,
        userId,
        courseId,
        courseTitle: course.title,
        accessUntil: access.accessUntil,
      })
      return access
    }

    // Create new access
    const accessUntil = course.rentalDays
      ? new Date(Date.now() + course.rentalDays * 24 * 60 * 60 * 1000)
      : null

    const access = await client.courseAccess.create({
      data: {
        userId,
        courseId,
        accessUntil,
        revokedAt: null,
      },
    })
    await NotificationEventService.courseAccessGranted({
      accessId: access.id,
      userId,
      courseId,
      courseTitle: course.title,
      accessUntil: access.accessUntil,
    })
    return access
  }

  /**
   * Revoke a student's course access without deleting historical enrollment.
   */
  static async revokeCourseAccess(userId: string, courseId: string) {
    const activeAccess = await db.courseAccess.findFirst({
      where: {
        userId,
        courseId,
        ...buildActiveCourseAccessWhere(),
      },
      include: {
        course: { select: { title: true } },
      },
    })

    if (!activeAccess) {
      return null
    }

    const access = await db.courseAccess.update({
      where: { id: activeAccess.id },
      data: { revokedAt: new Date() },
    })
    await cancelScheduledNotificationDeliveries({
      resource: { type: 'COURSE_ACCESS', id: activeAccess.id },
    })
    await NotificationEventService.courseAccessRevoked({
      accessId: activeAccess.id,
      userId,
      courseId,
      courseTitle: activeAccess.course.title,
    })
    return access
  }
}
