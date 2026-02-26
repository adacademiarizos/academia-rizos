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

      if (targetType === 'COMMENT') {
        // Notify the comment author
        const comment = await db.comment.findUnique({
          where: { id: targetId },
          select: { userId: true },
        })
        if (comment && comment.userId !== likerId) {
          await this.createNotification({
            userId: comment.userId,
            type: 'LIKE',
            title: 'A alguien le gustó tu comentario',
            message: `${liker.name} le dio me gusta a tu comentario`,
            relatedId: targetId,
          })
        }
      }
    } catch (error) {
      console.error('Error triggering like notification:', error)
      // Don't throw
    }
  }

  /**
   * Trigger notification when a certificate is issued to a student
   */
  static async triggerOnCertificateIssued(userId: string, courseId: string) {
    try {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      })

      if (!course?.title) return

      await this.createNotification({
        userId,
        type: 'CERTIFICATE',
        title: '¡Certificado disponible!',
        message: `Tu certificado de "${course.title}" está listo para descargar`,
        relatedId: courseId,
      })
    } catch (error) {
      console.error('Error triggering certificate notification:', error)
      // Don't throw
    }
  }

  /**
   * Trigger notification when a certificate is revoked
   */
  static async triggerOnCertificateRevoked(userId: string, courseId: string) {
    try {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      })

      await this.createNotification({
        userId,
        type: 'CERTIFICATE',
        title: 'Certificado revocado',
        message: `Tu certificado de "${course?.title ?? 'un curso'}" ha sido revocado por un administrador`,
        relatedId: courseId,
      })
    } catch (error) {
      console.error('Error triggering certificate revoked notification:', error)
      // Don't throw
    }
  }

  /**
   * Trigger notification when an exam submission is reviewed
   */
  static async triggerOnExamReview(
    userId: string,
    courseId: string,
    status: 'APPROVED' | 'REVISION_REQUESTED',
    reviewNote?: string | null
  ) {
    try {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      })

      const courseName = course?.title ?? 'tu curso'

      if (status === 'APPROVED') {
        await this.createNotification({
          userId,
          type: 'EXAM_REVIEW',
          title: '¡Examen aprobado!',
          message: `Tu examen de "${courseName}" fue aprobado. Recibirás tu certificado en breve.`,
          relatedId: courseId,
        })
      } else {
        await this.createNotification({
          userId,
          type: 'EXAM_REVIEW',
          title: 'Revisión solicitada en tu examen',
          message: reviewNote
            ? `Tu examen de "${courseName}" necesita revisiones: ${reviewNote}`
            : `Tu examen de "${courseName}" necesita algunas correcciones`,
          relatedId: courseId,
        })
      }
    } catch (error) {
      console.error('Error triggering exam review notification:', error)
      // Don't throw
    }
  }

  /**
   * Trigger notification when a course test submission is reviewed
   */
  static async triggerOnTestReview(
    userId: string,
    courseId: string,
    status: 'APPROVED' | 'REVISION_REQUESTED',
    isFinalExam: boolean,
  ) {
    try {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      })

      const courseName = course?.title ?? 'tu curso'

      if (status === 'APPROVED') {
        const message = isFinalExam
          ? `Tu examen final de "${courseName}" fue aprobado. Tu certificado está listo.`
          : `Tu evaluación de "${courseName}" fue aprobada. ¡Buen trabajo!`
        await this.createNotification({
          userId,
          type: 'EXAM_REVIEW',
          title: isFinalExam ? '¡Examen final aprobado!' : '¡Evaluación aprobada!',
          message,
          relatedId: courseId,
        })
      } else {
        await this.createNotification({
          userId,
          type: 'EXAM_REVIEW',
          title: 'Revisión solicitada',
          message: `Tu evaluación de "${courseName}" necesita algunas correcciones`,
          relatedId: courseId,
        })
      }
    } catch (error) {
      console.error('Error triggering test review notification:', error)
      // Don't throw
    }
  }

  /**
   * Trigger notification when an appointment status changes
   */
  static async triggerOnAppointmentStatus(
    userId: string,
    appointmentId: string,
    status: string,
    serviceName: string
  ) {
    try {
      const statusMessages: Record<string, { title: string; message: string }> = {
        CONFIRMED: {
          title: 'Cita confirmada',
          message: `Tu cita de "${serviceName}" ha sido confirmada`,
        },
        CANCELLED: {
          title: 'Cita cancelada',
          message: `Tu cita de "${serviceName}" fue cancelada`,
        },
        COMPLETED: {
          title: 'Cita completada',
          message: `Tu cita de "${serviceName}" fue marcada como completada`,
        },
        PENDING: {
          title: 'Cita en espera',
          message: `Tu cita de "${serviceName}" está en espera de confirmación`,
        },
      }

      const notif = statusMessages[status]
      if (!notif) return

      await this.createNotification({
        userId,
        type: 'APPOINTMENT',
        title: notif.title,
        message: notif.message,
        relatedId: appointmentId,
      })
    } catch (error) {
      console.error('Error triggering appointment status notification:', error)
      // Don't throw
    }
  }

  /**
   * Notify all admin users (in-app)
   */
  static async notifyAllAdmins({
    type,
    title,
    message,
    relatedId,
  }: { type: string; title: string; message: string; relatedId?: string }) {
    try {
      const admins = await db.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      })
      await Promise.all(
        admins.map((admin) =>
          this.createNotification({ userId: admin.id, type, title, message, relatedId })
        )
      )
    } catch (error) {
      console.error('Error notifying admins:', error)
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
