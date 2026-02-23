/**
 * Unit Tests for NotificationService
 * Tests the notification creation, retrieval, and marking logic
 */

import { NotificationService } from '@/server/services/notification-service'
import { db } from '@/lib/db'

// Mock database
jest.mock('@/lib/db', () => ({
  db: {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    courseAccess: {
      findMany: jest.fn(),
    },
  },
}))

describe('NotificationService', () => {
  const mockUserId = 'user-123'
  const mockNotification = {
    id: 'notif-1',
    userId: mockUserId,
    type: 'COMMENT',
    title: 'Nuevo comentario',
    message: 'Alguien comentó en tu curso',
    relatedId: 'course-1',
    isRead: false,
    createdAt: new Date(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createNotification', () => {
    it('should create a notification with valid data', async () => {
      ;(db.notification.create as jest.Mock).mockResolvedValue(mockNotification)

      const result = await NotificationService.createNotification({
        userId: mockUserId,
        type: 'COMMENT',
        title: 'Nuevo comentario',
        message: 'Alguien comentó en tu curso',
        relatedId: 'course-1',
      })

      expect(result).toEqual(mockNotification)
      expect(db.notification.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          type: 'COMMENT',
          title: 'Nuevo comentario',
          message: 'Alguien comentó en tu curso',
          relatedId: 'course-1',
        },
      })
    })

    it('should handle database errors', async () => {
      const error = new Error('Database error')
      ;(db.notification.create as jest.Mock).mockRejectedValue(error)

      await expect(
        NotificationService.createNotification({
          userId: mockUserId,
          type: 'COMMENT',
          title: 'Test',
          message: 'Test message',
        })
      ).rejects.toThrow('Database error')
    })
  })

  describe('getNotifications', () => {
    it('should fetch notifications with pagination', async () => {
      const mockNotifications = [mockNotification]
      ;(db.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications)
      ;(db.notification.count as jest.Mock).mockResolvedValue(1)

      const result = await NotificationService.getNotifications(mockUserId, {
        limit: 20,
        offset: 0,
      })

      expect(result.notifications).toEqual(mockNotifications)
      expect(result.total).toBe(1)
      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
          take: 20,
          skip: 0,
        })
      )
    })

    it('should filter by isRead flag', async () => {
      ;(db.notification.findMany as jest.Mock).mockResolvedValue([])
      ;(db.notification.count as jest.Mock).mockResolvedValue(0)

      await NotificationService.getNotifications(mockUserId, {
        isRead: false,
      })

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
            isRead: false,
          }),
        })
      )
    })

    it('should count unread notifications', async () => {
      ;(db.notification.findMany as jest.Mock).mockResolvedValue([])
      ;(db.notification.count as jest.Mock)
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(1) // unread

      const result = await NotificationService.getNotifications(mockUserId)

      expect(result.unreadCount).toBe(1)
      expect(db.notification.count).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isRead: false }),
        })
      )
    })
  })

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const readNotification = { ...mockNotification, isRead: true }
      ;(db.notification.update as jest.Mock).mockResolvedValue(readNotification)

      const result = await NotificationService.markAsRead('notif-1')

      expect(result.isRead).toBe(true)
      expect(db.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      })
    })
  })

  describe('markAllAsRead', () => {
    it('should mark all user notifications as read', async () => {
      ;(db.notification.updateMany as jest.Mock).mockResolvedValue({
        count: 5,
      })

      const result = await NotificationService.markAllAsRead(mockUserId)

      expect(result.count).toBe(5)
      expect(db.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, isRead: false },
        data: { isRead: true },
      })
    })
  })

  describe('triggerOnComment', () => {
    it('should not fail on errors', async () => {
      ;(db.user.findUnique as jest.Mock).mockResolvedValue(null)

      // Should not throw
      await expect(
        NotificationService.triggerOnComment(
          'commenter-1',
          'comment-1',
          'COURSE',
          'course-1'
        )
      ).resolves.not.toThrow()
    })

    it('should identify course and notify enrolled users', async () => {
      ;(db.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'commenter-1',
        name: 'John Doe',
      })
      ;(db.courseAccess.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-2' },
        { userId: 'user-3' },
      ])
      ;(db.notification.create as jest.Mock).mockResolvedValue(mockNotification)

      await NotificationService.triggerOnComment(
        'commenter-1',
        'comment-1',
        'COURSE',
        'course-1'
      )

      // Should create notifications for enrolled users (except commenter)
      expect(db.notification.create).toHaveBeenCalledTimes(2)
    })
  })
})
