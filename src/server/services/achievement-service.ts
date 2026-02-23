/**
 * AchievementService
 * Manages user achievements and badges
 */

import { db } from '@/lib/db'

interface AchievementDefinition {
  type: string
  name: string
  description: string
  check: (userId: string) => Promise<boolean>
}

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    type: 'FIRST_COURSE',
    name: 'Primer paso',
    description: 'Completa tu primer curso',
    check: async (userId: string) => {
      const completedCourses = await db.submission.count({
        where: {
          userId,
          status: 'APPROVED',
        },
      })
      return completedCourses >= 1
    },
  },
  {
    type: 'FIVE_COURSES',
    name: 'Aprendiz dedicado',
    description: 'Completa 5 cursos',
    check: async (userId: string) => {
      const completedCourses = await db.submission.count({
        where: {
          userId,
          status: 'APPROVED',
        },
      })
      return completedCourses >= 5
    },
  },
  {
    type: 'TEN_COURSES',
    name: 'Maestro del aprendizaje',
    description: 'Completa 10 cursos',
    check: async (userId: string) => {
      const completedCourses = await db.submission.count({
        where: {
          userId,
          status: 'APPROVED',
        },
      })
      return completedCourses >= 10
    },
  },
  {
    type: 'COMMUNITY_CONTRIBUTOR',
    name: 'Contribuidor de comunidad',
    description: 'Realiza 10 comentarios en la plataforma',
    check: async (userId: string) => {
      const commentsCount = await db.comment.count({
        where: { userId },
      })
      return commentsCount >= 10
    },
  },
  {
    type: 'SOCIAL_BUTTERFLY',
    name: 'Mariposa social',
    description: 'Dale like a 20 contenidos diferentes',
    check: async (userId: string) => {
      const likesCount = await db.like.count({
        where: { userId },
      })
      return likesCount >= 20
    },
  },
  {
    type: 'PERFECT_SCORE',
    name: 'Calificación perfecta',
    description: 'Obtén una calificación perfecta en un test',
    check: async (userId: string) => {
      // Check if user has a submission with full marks
      // For now, we'll consider any APPROVED submission as perfect
      const perfectSubmissions = await db.submission.count({
        where: {
          userId,
          status: 'APPROVED',
        },
      })
      return perfectSubmissions >= 1
    },
  },
]

export class AchievementService {
  /**
   * Check and award all eligible achievements for a user
   */
  static async checkAndAwardAchievements(userId: string) {
    try {
      const newAchievements = []

      for (const definition of ACHIEVEMENT_DEFINITIONS) {
        // Check if user already has this achievement
        const existing = await db.achievement.findUnique({
          where: { userId_type: { userId, type: definition.type } },
        })

        if (!existing) {
          // Check if conditions are met
          const isEligible = await definition.check(userId)

          if (isEligible) {
            const achievement = await db.achievement.create({
              data: {
                userId,
                type: definition.type,
                name: definition.name,
                description: definition.description,
              },
            })
            newAchievements.push(achievement)
            console.log(`✅ Achievement awarded: ${definition.name} to user ${userId}`)
          }
        }
      }

      return newAchievements
    } catch (error) {
      console.error('Error checking achievements:', error)
      throw error
    }
  }

  /**
   * Get all achievements for a user
   */
  static async getUserAchievements(userId: string) {
    try {
      const achievements = await db.achievement.findMany({
        where: { userId },
        orderBy: { earnedAt: 'desc' },
      })
      return achievements
    } catch (error) {
      console.error('Error fetching user achievements:', error)
      throw error
    }
  }

  /**
   * Record user activity and potentially trigger achievement checks
   */
  static async recordActivity(
    userId: string,
    type: string,
    courseId?: string,
    moduleId?: string
  ) {
    try {
      const activity = await db.userActivity.create({
        data: {
          userId,
          type,
          courseId,
          moduleId,
        },
      })

      // Automatically check for achievements after recording activity
      // This is called after major actions (completion, comments, etc.)
      if (['MODULE_COMPLETED', 'TEST_PASSED', 'COMMENT_POSTED', 'LIKE'].includes(type)) {
        setImmediate(() => {
          this.checkAndAwardAchievements(userId).catch((error) => {
            console.error('Error auto-checking achievements:', error)
          })
        })
      }

      return activity
    } catch (error) {
      console.error('Error recording activity:', error)
      throw error
    }
  }

  /**
   * Get achievement statistics
   */
  static async getAchievementStats(userId: string) {
    try {
      const achievements = await db.achievement.findMany({
        where: { userId },
      })

      return {
        totalAchievements: achievements.length,
        achievements,
        availableAchievements: ACHIEVEMENT_DEFINITIONS.length,
        completionPercentage: Math.round(
          (achievements.length / ACHIEVEMENT_DEFINITIONS.length) * 100
        ),
      }
    } catch (error) {
      console.error('Error calculating achievement stats:', error)
      throw error
    }
  }

  /**
   * Award achievement manually (for admin or special cases)
   */
  static async awardAchievement(userId: string, type: string) {
    try {
      const definition = ACHIEVEMENT_DEFINITIONS.find((a) => a.type === type)

      if (!definition) {
        throw new Error(`Unknown achievement type: ${type}`)
      }

      const achievement = await db.achievement.upsert({
        where: { userId_type: { userId, type } },
        create: {
          userId,
          type: definition.type,
          name: definition.name,
          description: definition.description,
        },
        update: {}, // If it exists, do nothing
      })

      return achievement
    } catch (error) {
      console.error('Error awarding achievement:', error)
      throw error
    }
  }
}
