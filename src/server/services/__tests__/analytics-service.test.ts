/**
 * Unit Tests for AnalyticsService
 * Tests calculation of user statistics and progress metrics
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { AnalyticsService } from '@/server/services/analytics-service'
import { db } from '@/lib/db'

vi.mock('@/lib/db', async () => {
  const { createDbMock } = await import('@/test/db-mock')
  return { db: createDbMock() }
})

describe('AnalyticsService', () => {
  const mockUserId = 'user-123'
  const mockCourseId = 'course-456'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserStats', () => {
    it('should calculate correct user statistics', async () => {
      ;(db.courseAccess.count as Mock).mockResolvedValue(3)
      ;(db.lessonProgress.count as Mock).mockResolvedValue(10)
      ;(db.lessonTestSubmission.count as Mock).mockResolvedValue(2)
      ;(db.courseTestSubmission.count as Mock).mockResolvedValue(1)
      ;(db.finalExamAttempt.count as Mock).mockResolvedValue(1)
      ;(db.userActivity.findFirst as Mock).mockResolvedValue({
        createdAt: new Date('2026-01-01'),
      })

      const stats = await AnalyticsService.getUserStats(mockUserId)

      expect(stats).toEqual({
        coursesEnrolled: 3,
        lessonsCompleted: 10,
        // `modulesCompleted` is kept as a backwards-compatible alias.
        modulesCompleted: 10,
        // Lesson tests, course tests and approved final exams all count as an
        // approved assessment from the student's point of view.
        testsPassed: 4,
        lastActivityAt: expect.any(Date),
      })
    })

    it('should handle zero activity', async () => {
      ;(db.courseAccess.count as Mock).mockResolvedValue(0)
      ;(db.lessonProgress.count as Mock).mockResolvedValue(0)
      ;(db.lessonTestSubmission.count as Mock).mockResolvedValue(0)
      ;(db.courseTestSubmission.count as Mock).mockResolvedValue(0)
      ;(db.finalExamAttempt.count as Mock).mockResolvedValue(0)
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
        revokedAt: null,
      })
      ;(db.lesson.count as Mock).mockResolvedValue(5)
      ;(db.lessonProgress.count as Mock).mockResolvedValue(3)
      ;(db.finalExamAttempt.findFirst as Mock).mockResolvedValue(null)
      ;(db.courseTestSubmission.findFirst as Mock).mockResolvedValue(null)
      ;(db.certificate.findFirst as Mock).mockResolvedValue(null)

      const progress = await AnalyticsService.getCourseProgress(mockUserId, mockCourseId)

      expect(progress?.percentComplete).toBe(60) // 3 of 5 = 60%
      expect(progress?.lessonsCompleted).toBe(3)
      expect(progress?.totalLessons).toBe(5)
      expect(progress?.finalExamPassed).toBe(false)
      expect(progress?.status).toBe('IN_PROGRESS')
    })

    it('should mark course as completed with the final exam approved', async () => {
      ;(db.courseAccess.findUnique as Mock).mockResolvedValue({ revokedAt: null })
      ;(db.lesson.count as Mock).mockResolvedValue(2)
      ;(db.lessonProgress.count as Mock).mockResolvedValue(2)
      ;(db.finalExamAttempt.findFirst as Mock).mockResolvedValue({
        id: 'attempt-1',
        status: 'APPROVED',
      })
      ;(db.courseTestSubmission.findFirst as Mock).mockResolvedValue(null)
      ;(db.certificate.findFirst as Mock).mockResolvedValue(null)

      const progress = await AnalyticsService.getCourseProgress(mockUserId, mockCourseId)

      expect(progress?.percentComplete).toBe(100)
      expect(progress?.finalExamPassed).toBe(true)
      expect(progress?.status).toBe('COMPLETED')
    })

    it('counts lessons by course, so style-based courses are not stuck at 0%', async () => {
      ;(db.courseAccess.findUnique as Mock).mockResolvedValue({ revokedAt: null })
      ;(db.lesson.count as Mock).mockResolvedValue(13)
      ;(db.lessonProgress.count as Mock).mockResolvedValue(13)
      ;(db.finalExamAttempt.findFirst as Mock).mockResolvedValue(null)
      ;(db.courseTestSubmission.findFirst as Mock).mockResolvedValue(null)
      ;(db.certificate.findFirst as Mock).mockResolvedValue(null)

      await AnalyticsService.getCourseProgress(mockUserId, mockCourseId)

      // Lessons attached to a style have no module, so a filter that walks
      // through `module` counts none of them.
      expect(db.lesson.count).toHaveBeenCalledWith({ where: { courseId: mockCourseId } })
      expect(db.lessonProgress.count).toHaveBeenCalledWith({
        where: { userId: mockUserId, completed: true, lesson: { courseId: mockCourseId } },
      })
    })

    it('treats an issued certificate as proof the course is finished', async () => {
      ;(db.courseAccess.findUnique as Mock).mockResolvedValue({ revokedAt: null })
      ;(db.lesson.count as Mock).mockResolvedValue(4)
      ;(db.lessonProgress.count as Mock).mockResolvedValue(0)
      ;(db.finalExamAttempt.findFirst as Mock).mockResolvedValue(null)
      ;(db.courseTestSubmission.findFirst as Mock).mockResolvedValue(null)
      ;(db.certificate.findFirst as Mock).mockResolvedValue({ id: 'cert-1' })

      const progress = await AnalyticsService.getCourseProgress(mockUserId, mockCourseId)

      // The percentage stays factual; the certificate is reported separately
      // so the UI can show both without either contradicting the other.
      expect(progress?.percentComplete).toBe(0)
      expect(progress?.hasCertificate).toBe(true)
      expect(progress?.status).toBe('COMPLETED')
    })

    it('closes the course when its final assessment is a course test', async () => {
      ;(db.courseAccess.findUnique as Mock).mockResolvedValue({ revokedAt: null })
      ;(db.lesson.count as Mock).mockResolvedValue(2)
      ;(db.lessonProgress.count as Mock).mockResolvedValue(2)
      ;(db.finalExamAttempt.findFirst as Mock).mockResolvedValue(null)
      ;(db.courseTestSubmission.findFirst as Mock).mockResolvedValue({ id: 'submission-1' })
      ;(db.certificate.findFirst as Mock).mockResolvedValue(null)

      const progress = await AnalyticsService.getCourseProgress(mockUserId, mockCourseId)

      expect(progress?.finalExamPassed).toBe(true)
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
      ;(db.lessonProgress.count as Mock).mockResolvedValue(5)
      ;(db.lessonTestSubmission.count as Mock).mockResolvedValue(1)
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
