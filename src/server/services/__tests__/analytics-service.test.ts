/**
 * Unit Tests for AnalyticsService
 * Tests calculation of user statistics and progress metrics
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { AnalyticsService } from '@/server/services/analytics-service'
import { db } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  db: {
    courseAccess: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    moduleProgress: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    submission: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    userActivity: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    module: {
      findMany: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
    },
    achievement: {
      findMany: vi.fn(),
    },
    comment: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    like: {
      count: vi.fn(),
    },
  },
}))

describe('AnalyticsService', () => {
  const mockUserId = 'user-123'
  const mockCourseId = 'course-456'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserStats', () => {
    it('should calculate correct user statistics', async () => {
      ;(db.courseAccess.count as Mock).mockResolvedValue(3)
      ;(db.moduleProgress.count as Mock).mockResolvedValue(10)
      ;(db.submission.count as Mock).mockResolvedValue(2)
      ;(db.userActivity.findFirst as Mock).mockResolvedValue({
        createdAt: new Date('2026-01-01'),
      })

      const stats = await AnalyticsService.getUserStats(mockUserId)

      expect(stats).toEqual({
        coursesEnrolled: 3,
        modulesCompleted: 10,
        testsPassed: 2,
        lastActivityAt: expect.any(Date),
      })
    })

    it('should handle zero activity', async () => {
      ;(db.courseAccess.count as Mock).mockResolvedValue(0)
      ;(db.moduleProgress.count as Mock).mockResolvedValue(0)
      ;(db.submission.count as Mock).mockResolvedValue(0)
      ;(db.userActivity.findFirst as Mock).mockResolvedValue(null)

      const stats = await AnalyticsService.getUserStats(mockUserId)

      expect(stats.coursesEnrolled).toBe(0)
      expect(stats.lastActivityAt).toBeNull()
    })
  })

  describe('getCourseProgress', () => {
    it('should return null if user has no access', async () => {
      ;(db.courseAccess.findUnique as Mock).mockResolvedValue(null)

      const progress = await AnalyticsService.getCourseProgress(mockUserId, mockCourseId)

      expect(progress).toBeNull()
    })

    it('should calculate correct course progress percentage', async () => {
      ;(db.courseAccess.findUnique as Mock).mockResolvedValue({
        userId: mockUserId,
        courseId: mockCourseId,
      })
      ;(db.module.findMany as Mock).mockResolvedValue([
        { id: 'mod-1' },
        { id: 'mod-2' },
        { id: 'mod-3' },
        { id: 'mod-4' },
        { id: 'mod-5' },
      ])
      ;(db.moduleProgress.count as Mock).mockResolvedValue(3)
      ;(db.submission.findFirst as Mock).mockResolvedValue(null)

      const progress = await AnalyticsService.getCourseProgress(mockUserId, mockCourseId)

      expect(progress?.percentComplete).toBe(60) // 3 of 5 = 60%
      expect(progress?.modulesCompleted).toBe(3)
      expect(progress?.totalModules).toBe(5)
      expect(progress?.testPassed).toBe(false)
      expect(progress?.status).toBe('IN_PROGRESS')
    })

    it('should mark course as completed with test passed', async () => {
      ;(db.courseAccess.findUnique as Mock).mockResolvedValue({})
      ;(db.module.findMany as Mock).mockResolvedValue([
        { id: 'mod-1' },
        { id: 'mod-2' },
      ])
      ;(db.moduleProgress.count as Mock).mockResolvedValue(2)
      ;(db.submission.findFirst as Mock).mockResolvedValue({
        id: 'sub-1',
        status: 'APPROVED',
      })

      const progress = await AnalyticsService.getCourseProgress(mockUserId, mockCourseId)

      expect(progress?.percentComplete).toBe(100)
      expect(progress?.testPassed).toBe(true)
      expect(progress?.status).toBe('COMPLETED')
    })
  })

  describe('getEngagementStats', () => {
    it('should calculate engagement metrics', async () => {
      ;(db.comment.count as Mock).mockResolvedValue(5)
      ;(db.like.count as Mock).mockResolvedValue(12)
      ;(db.comment.findMany as Mock).mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ])

      const stats = await AnalyticsService.getEngagementStats(mockUserId)

      expect(stats).toMatchObject({
        commentsCount: 5,
        likesCount: 12,
        followersCount: expect.any(Number),
      })
    })
  })

  describe('getActivityFeed', () => {
    it('should fetch paginated activity', async () => {
      const mockActivities = [
        {
          id: 'act-1',
          type: 'MODULE_COMPLETED',
          createdAt: new Date(),
        },
      ]
      ;(db.userActivity.findMany as Mock).mockResolvedValue(mockActivities)
      ;(db.userActivity.count as Mock).mockResolvedValue(1)

      const result = await AnalyticsService.getActivityFeed(mockUserId, 20, 0)

      expect(result.activities).toEqual(mockActivities)
      expect(result.total).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.offset).toBe(0)
    })

    it('should respect pagination parameters', async () => {
      ;(db.userActivity.findMany as Mock).mockResolvedValue([])
      ;(db.userActivity.count as Mock).mockResolvedValue(0)

      await AnalyticsService.getActivityFeed(mockUserId, 50, 100)

      expect(db.userActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 100,
        })
      )
    })
  })

  describe('getDashboardSnapshot', () => {
    it('should combine all dashboard data', async () => {
      ;(db.courseAccess.count as Mock).mockResolvedValue(2)
      ;(db.moduleProgress.count as Mock).mockResolvedValue(5)
      ;(db.submission.count as Mock).mockResolvedValue(1)
      ;(db.userActivity.findFirst as Mock).mockResolvedValue(null)
      ;(db.courseAccess.findMany as Mock).mockResolvedValue([])
      ;(db.comment.count as Mock).mockResolvedValue(3)
      ;(db.like.count as Mock).mockResolvedValue(8)
      ;(db.comment.findMany as Mock).mockResolvedValue([])
      ;(db.achievement.findMany as Mock).mockResolvedValue([])

      const snapshot = await AnalyticsService.getDashboardSnapshot(mockUserId)

      expect(snapshot).toHaveProperty('stats')
      expect(snapshot).toHaveProperty('engagementStats')
      expect(snapshot).toHaveProperty('coursesProgress')
      expect(snapshot).toHaveProperty('achievements')
      expect(snapshot.stats.coursesEnrolled).toBe(2)
    })
  })
})
