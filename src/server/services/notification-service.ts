/**
 * NotificationService
 * Handles creation, retrieval, and management of user notifications
 */

import { db } from '@/lib/db'

interface NotificationData {
  userId: string
  type: string
  title: string
  message: string
  relatedId?: string
}

export class NotificationService {
  /**
   * Create a new notification
   */
  static async createNotification({
    userId,
    type,
    title,
    message,
    relatedId,
  }: NotificationData) {
    try {
      const notification = await db.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          relatedId,
        },
      })
      return notification
    } catch (error) {
      console.error('Error creating notification:', error)
      throw error
    }
  }

  /**
   * Get user's notifications with pagination
   */
  static async getNotifications(
    userId: string,
    options?: {
      isRead?: boolean
      limit?: number
      offset?: number
    }
  ) {
    try {
      const { isRead, limit = 20, offset = 0 } = options || {}

      const where: any = { userId }
      if (typeof isRead === 'boolean') {
        where.isRead = isRead
      }

      const [notifications, total] = await Promise.all([
        db.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.notification.count({ where }),
      ])

      return {
        notifications,
        total,
        unreadCount: await db.notification.count({
          where: { userId, isRead: false },
        }),
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
      throw error
    }
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(notificationId: string) {
    try {
      const notification = await db.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      })
      return notification
    } catch (error) {
      console.error('Error marking notification as read:', error)
      throw error
    }
  }

  /**
   * Mark all user notifications as read
   */
  static async markAllAsRead(userId: string) {
    try {
      const result = await db.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      })
      return result
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      throw error
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: string) {
    try {
      const notification = await db.notification.delete({
        where: { id: notificationId },
      })
      return notification
    } catch (error) {
      console.error('Error deleting notification:', error)
      throw error
    }
  }

  /**
   * Trigger notification when someone comments
   * Notifies: course owner/creator
   */
  static async triggerOnComment(
    commenterId: string,
    commentId: string,
    targetType: string,
    targetId: string
  ) {
    try {
      const commenter = await db.user.findUnique({
        where: { id: commenterId },
        select: { name: true },
      })

      if (!commenter?.name) return

      // For now, notify all users enrolled in the course
      if (targetType === 'COURSE') {
        const enrolledUsers = await db.courseAccess.findMany({
          where: { courseId: targetId },
          select: { userId: true },
          distinct: ['userId'],
        })

        for (const { userId } of enrolledUsers) {
          if (userId !== commenterId) {
            await this.createNotification({
              userId,
              type: 'COMMENT',
              title: 'Nuevo comentario',
              message: `${commenter.name} comentó en el curso`,
              relatedId: targetId,
            })
          }
        }
      }
    } catch (error) {
      console.error('Error triggering comment notification:', error)
      // Don't throw - notifications shouldn't break main flow
    }
  }

  /**
   * Trigger notification when someone likes content
   */
  static async triggerOnLike(
    likerId: string,
    targetType: string,
    targetId: string
  ) {
    try {
      const liker = await db.user.findUnique({
        where: { id: likerId },
        select: { name: true },
      })

      if (!liker?.name) return

      // Notify relevant users (e.g., course owners)
      // For now, we'll just log it
      // In production, this would notify course authors, etc.
    } catch (error) {
      console.error('Error triggering like notification:', error)
      // Don't throw
    }
  }

  /**
   * Trigger notification when user completes a course/test
   */
  static async triggerOnCourseCompletion(userId: string, courseId: string) {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { name: true },
      })

      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      })

      if (!user?.name || !course?.title) return

      await this.createNotification({
        userId,
        type: 'COURSE_COMPLETION',
        title: '¡Curso finalizado!',
        message: `Felicidades, completaste "${course.title}"`,
        relatedId: courseId,
      })
    } catch (error) {
      console.error('Error triggering completion notification:', error)
      // Don't throw
    }
  }

  /**
   * Trigger notification when user enrolls in a course (after purchase)
   */
  static async triggerOnCourseEnrollment(userId: string, courseId: string) {
    try {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      })

      if (!course?.title) return

      await this.createNotification({
        userId,
        type: 'PAYMENT',
        title: '¡Acceso otorgado!',
        message: `Ahora tienes acceso a "${course.title}"`,
        relatedId: courseId,
      })
    } catch (error) {
      console.error('Error triggering enrollment notification:', error)
      // Don't throw
    }
  }
}
