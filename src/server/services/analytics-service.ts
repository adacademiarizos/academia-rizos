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
        where: { userId },
      })

      // Modules completed
      const modulesCompleted = await db.moduleProgress.count({
        where: { userId, completed: true },
      })

      // Tests passed (approved submissions)
      const testsPassed = await db.submission.count({
        where: {
          userId,
          status: 'APPROVED',
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
        modulesCompleted,
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

      if (!access) {
        return null // No access
      }

      // Get all modules in course
      const modules = await db.module.findMany({
        where: { courseId },
        select: { id: true },
      })

      const totalModules = modules.length

      // Get completed modules
      const completedModules = await db.moduleProgress.count({
        where: {
          userId,
          moduleId: {
            in: modules.map((m) => m.id),
          },
          completed: true,
        },
      })

      const percentComplete =
        totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0

      // Check if test was passed
      const testPassed = await db.submission.findFirst({
        where: {
          userId,
          test: {
            courseId,
          },
          status: 'APPROVED',
        },
      })

      return {
        percentComplete,
        modulesCompleted: completedModules,
        totalModules,
        testPassed: !!testPassed,
        status: percentComplete === 100 && testPassed ? 'COMPLETED' : 'IN_PROGRESS',
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
        where: { userId },
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
