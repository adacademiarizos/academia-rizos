/**
 * AnalyticsService
 * Calculates user statistics and metrics for dashboards
 */

import { db } from '@/lib/db'

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

      // Lesson progress is canonical.
      const lessonsCompleted = await db.lessonProgress.count({
        where: { userId },
      })

      // Lesson tests are automatically scored; a passing submission is retained.
      const testsPassed = await db.lessonTestSubmission.count({
        where: {
          userId,
          isPassed: true,
        },
      })

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

      const totalLessons = await db.lesson.count({ where: { module: { courseId } } })
      const completedLessons = await db.lessonProgress.count({
        where: { userId, lesson: { module: { courseId } } },
      })

      const percentComplete =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

      // Completion requires a manually approved course final exam.
      const finalExamPassed = await db.finalExamAttempt.findFirst({
        where: {
          userId,
          status: 'APPROVED',
          finalExam: {
            courseId,
          },
        },
      })

      return {
        percentComplete,
        lessonsCompleted: completedLessons,
        totalLessons,
        finalExamPassed: !!finalExamPassed,
        status: percentComplete === 100 && finalExamPassed ? 'COMPLETED' : 'IN_PROGRESS',
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
          return {
            ...progress,
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
