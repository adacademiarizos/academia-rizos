/**
 * Unit Tests for AchievementService
 * Tests achievement checking, awarding, and activity recording
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { AchievementService } from '@/server/services/achievement-service'
import { db } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  db: {
    achievement: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    submission: {
      count: vi.fn(),
    },
    comment: {
      count: vi.fn(),
    },
    like: {
      count: vi.fn(),
    },
    userActivity: {
      create: vi.fn(),
    },
  },
}))

describe('AchievementService', () => {
  const mockUserId = 'user-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkAndAwardAchievements', () => {
    it('should award FIRST_COURSE achievement', async () => {
      ;(db.achievement.findUnique as Mock).mockResolvedValue(null)
      ;(db.submission.count as Mock).mockResolvedValue(1)
      ;(db.comment.count as Mock).mockResolvedValue(0)
      ;(db.like.count as Mock).mockResolvedValue(0)

      const mockAchievement = {
        id: 'ach-1',
        userId: mockUserId,
        type: 'FIRST_COURSE',
        name: 'Primer paso',
      }
      ;(db.achievement.create as Mock).mockResolvedValue(mockAchievement)

      const result = await AchievementService.checkAndAwardAchievements(mockUserId)

      expect(result).toContainEqual(
        expect.objectContaining({
          type: 'FIRST_COURSE',
        })
      )
      expect(db.achievement.create).toHaveBeenCalled()
    })

    it('should award FIVE_COURSES achievement', async () => {
      ;(db.achievement.findUnique as Mock).mockResolvedValue(null)
      ;(db.submission.count as Mock).mockResolvedValue(5)
      ;(db.comment.count as Mock).mockResolvedValue(0)
      ;(db.like.count as Mock).mockResolvedValue(0)

      const mockAchievement = {
        id: 'ach-2',
        userId: mockUserId,
        type: 'FIVE_COURSES',
        name: 'Aprendiz dedicado',
      }
      ;(db.achievement.create as Mock).mockResolvedValue(mockAchievement)

      const result = await AchievementService.checkAndAwardAchievements(mockUserId)

      // Should create for both FIRST_COURSE and FIVE_COURSES
      expect(db.achievement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'FIVE_COURSES',
          }),
        })
      )
    })

    it('should award COMMUNITY_CONTRIBUTOR achievement', async () => {
      ;(db.achievement.findUnique as Mock).mockResolvedValue(null)
      ;(db.submission.count as Mock).mockResolvedValue(0)
      ;(db.comment.count as Mock).mockResolvedValue(10)
      ;(db.like.count as Mock).mockResolvedValue(0)

      const mockAchievement = {
        id: 'ach-3',
        userId: mockUserId,
        type: 'COMMUNITY_CONTRIBUTOR',
        name: 'Contribuidor de comunidad',
      }
      ;(db.achievement.create as Mock).mockResolvedValue(mockAchievement)

      const result = await AchievementService.checkAndAwardAchievements(mockUserId)

      expect(db.achievement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'COMMUNITY_CONTRIBUTOR',
          }),
        })
      )
    })

    it('should award SOCIAL_BUTTERFLY achievement', async () => {
      ;(db.achievement.findUnique as Mock).mockResolvedValue(null)
      ;(db.submission.count as Mock).mockResolvedValue(0)
      ;(db.comment.count as Mock).mockResolvedValue(0)
      ;(db.like.count as Mock).mockResolvedValue(20)

      const mockAchievement = {
        id: 'ach-4',
        userId: mockUserId,
        type: 'SOCIAL_BUTTERFLY',
        name: 'Mariposa social',
      }
      ;(db.achievement.create as Mock).mockResolvedValue(mockAchievement)

      const result = await AchievementService.checkAndAwardAchievements(mockUserId)

      expect(db.achievement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'SOCIAL_BUTTERFLY',
          }),
        })
      )
    })

    it('should not re-award existing achievements', async () => {
      const existingAchievement = {
        id: 'ach-1',
        type: 'FIRST_COURSE',
      }
      ;(db.achievement.findUnique as Mock).mockResolvedValue(existingAchievement)

      const result = await AchievementService.checkAndAwardAchievements(mockUserId)

      // Since user already has FIRST_COURSE, it shouldn't be created again
      expect(result).not.toContainEqual(
        expect.objectContaining({
          type: 'FIRST_COURSE',
        })
      )
    })
  })

  describe('getUserAchievements', () => {
    it('should fetch user achievements sorted by date', async () => {
      const mockAchievements = [
        {
          id: 'ach-1',
          type: 'FIRST_COURSE',
          name: 'Primer paso',
          earnedAt: new Date('2026-01-15'),
        },
        {
          id: 'ach-2',
          type: 'COMMUNITY_CONTRIBUTOR',
          name: 'Contribuidor',
          earnedAt: new Date('2026-01-10'),
        },
      ]
      ;(db.achievement.findMany as Mock).mockResolvedValue(mockAchievements)

      const result = await AchievementService.getUserAchievements(mockUserId)

      expect(result).toEqual(mockAchievements)
      expect(db.achievement.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { earnedAt: 'desc' },
      })
    })

    it('should return empty array if user has no achievements', async () => {
      ;(db.achievement.findMany as Mock).mockResolvedValue([])

      const result = await AchievementService.getUserAchievements(mockUserId)

      expect(result).toEqual([])
    })
  })

  describe('recordActivity', () => {
    it('should record activity correctly', async () => {
      const mockActivity = {
        id: 'act-1',
        userId: mockUserId,
        type: 'MODULE_COMPLETED',
        courseId: 'course-1',
        createdAt: new Date(),
      }
      ;(db.userActivity.create as Mock).mockResolvedValue(mockActivity)

      const result = await AchievementService.recordActivity(
        mockUserId,
        'MODULE_COMPLETED',
        'course-1'
      )

      expect(result).toEqual(mockActivity)
      expect(db.userActivity.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          type: 'MODULE_COMPLETED',
          courseId: 'course-1',
          moduleId: undefined,
        },
      })
    })

    it('should trigger achievement check for trigger-worthy activities', async () => {
      ;(db.userActivity.create as Mock).mockResolvedValue({})
      ;(db.achievement.findUnique as Mock).mockResolvedValue(null)

      // These activity types should trigger achievement checks
      const triggerActivities = [
        'MODULE_COMPLETED',
        'TEST_PASSED',
        'COMMENT_POSTED',
        'LIKE',
      ]

      for (const activity of triggerActivities) {
        vi.useFakeTimers()
        await AchievementService.recordActivity(mockUserId, activity)
        vi.runAllTimers()
        vi.useRealTimers()
      }

      expect(db.userActivity.create).toHaveBeenCalledTimes(4)
    })
  })

  describe('getAchievementStats', () => {
    it('should calculate achievement statistics', async () => {
      const mockAchievements = [
        { id: 'ach-1', type: 'FIRST_COURSE' },
        { id: 'ach-2', type: 'FIVE_COURSES' },
      ]
      ;(db.achievement.findMany as Mock).mockResolvedValue(mockAchievements)

      const stats = await AchievementService.getAchievementStats(mockUserId)

      expect(stats.totalAchievements).toBe(2)
      expect(stats.availableAchievements).toBeGreaterThan(0)
      expect(stats.completionPercentage).toBeGreaterThan(0)
    })
  })

  describe('awardAchievement', () => {
    it('should award achievement manually', async () => {
      const mockAchievement = {
        id: 'ach-1',
        userId: mockUserId,
        type: 'FIRST_COURSE',
        name: 'Primer paso',
      }
      ;(db.achievement.upsert as Mock).mockResolvedValue(mockAchievement)

      const result = await AchievementService.awardAchievement(
        mockUserId,
        'FIRST_COURSE'
      )

      expect(result).toEqual(mockAchievement)
    })

    it('should throw error for unknown achievement type', async () => {
      await expect(
        AchievementService.awardAchievement(mockUserId, 'UNKNOWN_TYPE')
      ).rejects.toThrow('Unknown achievement type')
    })
  })
})
