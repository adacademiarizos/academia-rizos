/**
 * Unit Tests for NotificationService
 * Tests the notification creation, retrieval, and marking logic
 */

import { NotificationService } from '@/server/services/notification-service'
import { db } from '@/lib/db'
import {
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
  NotificationPriority,
} from '@prisma/client'

// Mock database
jest.mock('@/lib/db', () => ({
  db: {
    $transaction: jest.fn(),
    notification: {
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    notificationDelivery: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
    ;(db.$transaction as jest.Mock).mockImplementation(async (callback) => callback(db))
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
        data: { isRead: true, readAt: expect.any(Date) },
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
        data: { isRead: true, readAt: expect.any(Date) },
      })
    })
  })

  describe('triggerOnAppointmentStatus', () => {
    it('creates a no-show notification', async () => {
      ;(db.notification.create as jest.Mock).mockResolvedValue(mockNotification)

      await NotificationService.triggerOnAppointmentStatus(
        mockUserId,
        'appointment-1',
        'NO_SHOW',
        'Corte'
      )

      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          type: 'APPOINTMENT',
          title: 'Inasistencia registrada',
          relatedId: 'appointment-1',
        }),
      })
    })
  })

  describe('notifyAllAdmins', () => {
    it('excludes the assigned staff member from the admin broadcast', async () => {
      ;(db.user.findMany as jest.Mock).mockResolvedValue([{ id: 'admin-2' }])
      ;(db.notification.create as jest.Mock).mockResolvedValue(mockNotification)

      await NotificationService.notifyAllAdmins({
        type: 'APPOINTMENT',
        title: 'Nueva cita reservada',
        message: 'Ada reservó Corte',
        relatedId: 'appointment-1',
        excludeUserIds: ['staff-1'],
      })

      expect(db.user.findMany).toHaveBeenCalledWith({
        where: { role: 'ADMIN', id: { notIn: ['staff-1'] } },
        select: { id: true },
      })
      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'admin-2' }),
      })
    })
  })

  describe('legacy community notification triggers', () => {
    it('does not broadcast a comment to enrolled users', async () => {
      await NotificationService.triggerOnComment(
        'commenter-1',
        'comment-1',
        'COURSE',
        'course-1'
      )

      expect(db.notification.create).not.toHaveBeenCalled()
      expect(db.courseAccess.findMany).not.toHaveBeenCalled()
    })

    it('does not create a recipient notification for likes', async () => {
      await NotificationService.triggerOnLike('liker-1', 'COMMENT', 'comment-1')

      expect(db.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('dispatch', () => {
    it('persists immediate in-app delivery and queues email with recipient-scoped dedupe keys', async () => {
      ;(db.notification.upsert as jest.Mock).mockResolvedValue({ id: 'notif-1' })
      ;(db.notificationDelivery.upsert as jest.Mock).mockResolvedValue({ id: 'delivery-1' })

      const result = await NotificationService.dispatch({
        eventKey: 'appointment.paid',
        type: 'APPOINTMENT',
        title: 'Cita confirmada',
        message: 'La cita fue confirmada',
        recipients: [{ userId: mockUserId, email: 'student@example.com' }],
        channels: [
          NotificationDeliveryChannel.IN_APP,
          NotificationDeliveryChannel.EMAIL,
        ],
        resource: { type: 'APPOINTMENT', id: 'appointment-1' },
        actionUrl: '/appointments/appointment-1',
        priority: NotificationPriority.HIGH,
        dedupeKey: 'stripe:event-1:appointment-paid',
      })

      expect(result).toEqual({ ok: true, notifications: 1, deliveries: 2 })
      expect(db.$transaction).toHaveBeenCalledTimes(1)
      expect(db.notification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_dedupeKey: {
              userId: mockUserId,
              dedupeKey: 'stripe:event-1:appointment-paid:user:user-123',
            },
          },
          create: expect.objectContaining({
            eventKey: 'appointment.paid',
            type: 'APPOINTMENT',
            relatedId: 'appointment-1',
            resourceType: 'APPOINTMENT',
            resourceId: 'appointment-1',
            actionUrl: '/appointments/appointment-1',
            priority: NotificationPriority.HIGH,
          }),
        })
      )
      expect(db.notificationDelivery.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          create: expect.objectContaining({
            channel: NotificationDeliveryChannel.IN_APP,
            notificationId: 'notif-1',
            recipientUserId: mockUserId,
            status: NotificationDeliveryStatus.SENT,
          }),
        })
      )
      expect(db.notificationDelivery.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          create: expect.objectContaining({
            channel: NotificationDeliveryChannel.EMAIL,
            notificationId: 'notif-1',
            recipientEmail: 'student@example.com',
            status: NotificationDeliveryStatus.PENDING,
          }),
        })
      )
    })

    it('keeps a future IN_APP notification pending until the worker materializes it', async () => {
      const scheduledFor = new Date(Date.now() + 60 * 60 * 1000)
      ;(db.notificationDelivery.upsert as jest.Mock).mockResolvedValue({ id: 'delivery-1' })

      const result = await NotificationService.dispatch({
        eventKey: 'appointment.reminder_24h',
        type: 'APPOINTMENT',
        title: 'Recordatorio de cita',
        message: 'Tu cita es mañana',
        recipients: [{ userId: mockUserId }],
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: 'APPOINTMENT', id: 'appointment-1' },
        dedupeKey: 'appointment-1:reminder-24h:2026-08-10T10:00:00.000Z',
        scheduledFor,
      })

      expect(result).toEqual({ ok: true, notifications: 0, deliveries: 1 })
      expect(db.notification.upsert).not.toHaveBeenCalled()
      expect(db.notificationDelivery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            channel: NotificationDeliveryChannel.IN_APP,
            recipientUserId: mockUserId,
            status: NotificationDeliveryStatus.PENDING,
            scheduledFor,
          }),
        })
      )
    })

    it('returns an error result instead of throwing when dispatch validation fails', async () => {
      await expect(
        NotificationService.dispatch({
          eventKey: 'appointment.paid',
          type: 'APPOINTMENT',
          title: 'Cita confirmada',
          message: 'La cita fue confirmada',
          recipients: [{ userId: mockUserId }],
          actionUrl: 'https://untrusted.example',
          dedupeKey: 'event-1',
        })
      ).resolves.toEqual({
        ok: false,
        notifications: 0,
        deliveries: 0,
        error: 'NOTIFICATION_DISPATCH_FAILED',
      })
      expect(db.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('cancelScheduledDeliveries', () => {
    it('only cancels pending deliveries scoped to the explicit resource and event', async () => {
      ;(db.notificationDelivery.updateMany as jest.Mock).mockResolvedValue({ count: 2 })

      await expect(
        NotificationService.cancelScheduledDeliveries({
          resource: { type: 'APPOINTMENT', id: 'appointment-1' },
          eventKey: 'appointment.reminder_24h',
        })
      ).resolves.toEqual({ ok: true, count: 2 })

      expect(db.notificationDelivery.updateMany).toHaveBeenCalledWith({
        where: {
          resourceType: 'APPOINTMENT',
          resourceId: 'appointment-1',
          status: NotificationDeliveryStatus.PENDING,
          eventKey: 'appointment.reminder_24h',
        },
        data: { status: NotificationDeliveryStatus.CANCELLED },
      })
    })
  })

  describe('dispatch', () => {
    it('persists immediate in-app delivery and queues email with recipient-scoped dedupe keys', async () => {
      ;(db.notification.upsert as jest.Mock).mockResolvedValue({ id: 'notif-1' })
      ;(db.notificationDelivery.upsert as jest.Mock).mockResolvedValue({ id: 'delivery-1' })

      const result = await NotificationService.dispatch({
        eventKey: 'appointment.paid',
        type: 'APPOINTMENT',
        title: 'Cita confirmada',
        message: 'La cita fue confirmada',
        recipients: [{ userId: mockUserId, email: 'student@example.com' }],
        channels: [
          NotificationDeliveryChannel.IN_APP,
          NotificationDeliveryChannel.EMAIL,
        ],
        resource: { type: 'APPOINTMENT', id: 'appointment-1' },
        actionUrl: '/appointments/appointment-1',
        priority: NotificationPriority.HIGH,
        dedupeKey: 'stripe:event-1:appointment-paid',
      })

      expect(result).toEqual({ ok: true, notifications: 1, deliveries: 2 })
      expect(db.$transaction).toHaveBeenCalledTimes(1)
      expect(db.notification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_dedupeKey: {
              userId: mockUserId,
              dedupeKey: 'stripe:event-1:appointment-paid:user:user-123',
            },
          },
          create: expect.objectContaining({
            eventKey: 'appointment.paid',
            type: 'APPOINTMENT',
            relatedId: 'appointment-1',
            resourceType: 'APPOINTMENT',
            resourceId: 'appointment-1',
            actionUrl: '/appointments/appointment-1',
            priority: NotificationPriority.HIGH,
          }),
        })
      )
      expect(db.notificationDelivery.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          create: expect.objectContaining({
            channel: NotificationDeliveryChannel.IN_APP,
            notificationId: 'notif-1',
            recipientUserId: mockUserId,
            status: NotificationDeliveryStatus.SENT,
          }),
        })
      )
      expect(db.notificationDelivery.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          create: expect.objectContaining({
            channel: NotificationDeliveryChannel.EMAIL,
            notificationId: 'notif-1',
            recipientEmail: 'student@example.com',
            status: NotificationDeliveryStatus.PENDING,
          }),
        })
      )
    })

    it('keeps a future IN_APP notification pending until the worker materializes it', async () => {
      const scheduledFor = new Date(Date.now() + 60 * 60 * 1000)
      ;(db.notificationDelivery.upsert as jest.Mock).mockResolvedValue({ id: 'delivery-1' })

      const result = await NotificationService.dispatch({
        eventKey: 'appointment.reminder_24h',
        type: 'APPOINTMENT',
        title: 'Recordatorio de cita',
        message: 'Tu cita es mañana',
        recipients: [{ userId: mockUserId }],
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: 'APPOINTMENT', id: 'appointment-1' },
        dedupeKey: 'appointment-1:reminder-24h:2026-08-10T10:00:00.000Z',
        scheduledFor,
      })

      expect(result).toEqual({ ok: true, notifications: 0, deliveries: 1 })
      expect(db.notification.upsert).not.toHaveBeenCalled()
      expect(db.notificationDelivery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            channel: NotificationDeliveryChannel.IN_APP,
            recipientUserId: mockUserId,
            status: NotificationDeliveryStatus.PENDING,
            scheduledFor,
          }),
        })
      )
    })

    it('returns an error result instead of throwing when dispatch validation fails', async () => {
      await expect(
        NotificationService.dispatch({
          eventKey: 'appointment.paid',
          type: 'APPOINTMENT',
          title: 'Cita confirmada',
          message: 'La cita fue confirmada',
          recipients: [{ userId: mockUserId }],
          actionUrl: 'https://untrusted.example',
          dedupeKey: 'event-1',
        })
      ).resolves.toEqual({
        ok: false,
        notifications: 0,
        deliveries: 0,
        error: 'NOTIFICATION_DISPATCH_FAILED',
      })
      expect(db.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('cancelScheduledDeliveries', () => {
    it('only cancels pending deliveries scoped to the explicit resource and event', async () => {
      ;(db.notificationDelivery.updateMany as jest.Mock).mockResolvedValue({ count: 2 })

      await expect(
        NotificationService.cancelScheduledDeliveries({
          resource: { type: 'APPOINTMENT', id: 'appointment-1' },
          eventKey: 'appointment.reminder_24h',
        })
      ).resolves.toEqual({ ok: true, count: 2 })

      expect(db.notificationDelivery.updateMany).toHaveBeenCalledWith({
        where: {
          resourceType: 'APPOINTMENT',
          resourceId: 'appointment-1',
          status: NotificationDeliveryStatus.PENDING,
          eventKey: 'appointment.reminder_24h',
        },
        data: { status: NotificationDeliveryStatus.CANCELLED },
      })
    })
  })
})
