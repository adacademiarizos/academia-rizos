/**
 * AnalyticsService
 * Calculates user statistics and metrics for dashboards
 */

import { db } from '@/lib/db'
import { getCourseLessonProgress } from '@/server/services/course-lesson-progress'

export class AnalyticsService {
  /**
   * Get comprehensive user statistics for dashboard
   */
  static async getUserStats(userId: string) {
    try {
      // Courses enrolled
      const coursesEnrolled = await db.courseAccess.count({
        where: { userId, revokedAt: null },
      })

      // Lesson progress is canonical, and the row existing is not the same as
      // the lesson being done: the style player creates the row on first play
      // and flips `completed` later, so counting rows inflates the number.
      const lessonsCompleted = await db.lessonProgress.count({
        where: { userId, completed: true },
      })

      // "Tests aprobados" means every assessment the student passed, not only
      // the per-lesson ones. Course tests and the manually reviewed final exam
      // are what a student actually thinks of as an approved exam, so leaving
      // them out reported 0 to people holding a certificate.
      const [lessonTestsPassed, courseTestsPassed, finalExamsPassed] = await Promise.all([
        db.lessonTestSubmission.count({
          where: { userId, isPassed: true },
        }),
        db.courseTestSubmission.count({
          where: { userId, isPassed: true },
        }),
        db.finalExamAttempt.count({
          where: { userId, status: 'APPROVED' },
        }),
      ])

      const testsPassed = lessonTestsPassed + courseTestsPassed + finalExamsPassed

      // Last activity timestamp
      const lastActivity = await db.userActivity.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })

      return {
        coursesEnrolled,
        lessonsCompleted,
        // Backwards-compatible alias while secondary dashboards migrate.
        modulesCompleted: lessonsCompleted,
        testsPassed,
        lastActivityAt: lastActivity?.createdAt || null,
      }
    } catch (error) {
      console.error('Error calculating user stats:', error)
      throw error
    }
  }

  /**
   * Get progress metrics for a specific course
   */
  static async getCourseProgress(userId: string, courseId: string) {
    try {
      // Check if user has access
      const access = await db.courseAccess.findUnique({
        where: { userId_courseId: { userId, courseId } },
      })

      if (!access || access.revokedAt) {
        return null // No access
      }

      // The course page and this dashboard used to compute the same number in
      // two different ways and disagree in front of the student. There is one
      // implementation now, and it is the one the course page already trusted.
      const { totalLessons, completedLessons, percentage: percentComplete } =
        await getCourseLessonProgress(userId, courseId)

      // A course closes with either the manually reviewed final exam or a
      // course test flagged as the final one, depending on how it was built.
      // Checking only the first left courses that use the second permanently
      // "in progress" for students who had already passed them.
      const [finalExamAttempt, finalCourseTest, certificate] = await Promise.all([
        db.finalExamAttempt.findFirst({
          where: { userId, status: 'APPROVED', finalExam: { courseId } },
          select: { id: true },
        }),
        db.courseTestSubmission.findFirst({
          where: { userId, isPassed: true, courseTest: { courseId, isFinalExam: true } },
          select: { id: true },
        }),
        db.certificate.findFirst({
          where: { userId, courseId, valid: true },
          select: { id: true },
        }),
      ])

      // A certificate says the course was passed; it does not rewrite how many
      // lessons are ticked off today. Reporting 100% because one exists is how
      // the dashboard ended up claiming 100% while the course page honestly
      // said 3%. The percentage stays factual and the certificate travels
      // beside it as its own fact, for the UI to show and link.
      const finalExamPassed = Boolean(finalExamAttempt || finalCourseTest || certificate)
      const completed = Boolean(certificate) || (percentComplete === 100 && finalExamPassed)

      return {
        percentComplete,
        lessonsCompleted: completedLessons,
        totalLessons,
        finalExamPassed,
        hasCertificate: Boolean(certificate),
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
      }
    } catch (error) {
      console.error('Error calculating course progress:', error)
      throw error
    }
  }

  /**
   * Get engagement statistics (comments, likes, followers)
   */
  static async getEngagementStats(userId: string) {
    try {
      const commentsCount = await db.comment.count({
        where: { userId },
      })

      const likesCount = await db.like.count({
        where: { userId },
      })

      // Count unique users who liked content from this user
      // (proxy for "followers" - users who engaged with their content)
      const followers = await db.comment.findMany({
        where: {
          user: {
            id: userId,
          },
        },
        select: { userId: true },
        distinct: ['userId'],
      })

      return {
        commentsCount,
        likesCount,
        followersCount: followers.length,
      }
    } catch (error) {
      console.error('Error calculating engagement stats:', error)
      throw error
    }
  }

  /**
   * Get paginated activity feed for a user (public view)
   */
  static async getActivityFeed(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ) {
    try {
      const [activities, total] = await Promise.all([
        db.userActivity.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.userActivity.count({ where: { userId } }),
      ])

      return {
        activities,
        total,
        limit,
        offset,
      }
    } catch (error) {
      console.error('Error fetching activity feed:', error)
      throw error
    }
  }

  /**
   * Get all courses progress for a user
   */
  static async getCoursesProgress(userId: string) {
    try {
      const courses = await db.courseAccess.findMany({
        where: { userId, revokedAt: null },
        select: { courseId: true },
      })

      const progressList = await Promise.all(
        courses.map(async (c) => {
          const progress = await this.getCourseProgress(userId, c.courseId)
          const course = await db.course.findUnique({
            where: { id: c.courseId },
            select: { id: true, title: true },
          })
          // `getCourseProgress` returns null when access was revoked between
          // the two queries; spreading that null used to produce a card with
          // an undefined percentage instead of a plain zero.
          return {
            percentComplete: 0,
            lessonsCompleted: 0,
            totalLessons: 0,
            finalExamPassed: false,
            hasCertificate: false,
            status: 'IN_PROGRESS' as const,
            ...(progress ?? {}),
            courseId: c.courseId,
            courseTitle: course?.title,
          }
        })
      )

      return progressList
    } catch (error) {
      console.error('Error fetching courses progress:', error)
      throw error
    }
  }

  /**
   * Get snapshot for user dashboard
   */
  static async getDashboardSnapshot(userId: string) {
    try {
      const [stats, engagementStats, coursesProgress, achievements] =
        await Promise.all([
          this.getUserStats(userId),
          this.getEngagementStats(userId),
          this.getCoursesProgress(userId),
          db.achievement.findMany({
            where: { userId },
            orderBy: { earnedAt: 'desc' },
          }),
        ])

      return {
        stats,
        engagementStats,
        coursesProgress,
        achievements,
      }
    } catch (error) {
      console.error('Error fetching dashboard snapshot:', error)
      throw error
    }
  }
}
