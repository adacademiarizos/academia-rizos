/**
 * NotificationService
 * Handles creation, retrieval, and management of user notifications
 */

import { db } from '@/lib/db'
import { buildActiveCourseAccessWhere } from '@/lib/course-access'
import { NotificationDeliveryChannel, NotificationPriority } from '@prisma/client'
import {
  cancelScheduledNotificationDeliveries,
  dispatchNotification,
  materializeInAppNotificationDelivery,
  type CancelScheduledDeliveriesInput,
  type NotificationDispatchInput,
  type PendingInAppDelivery,
} from '@/server/services/notification-dispatcher'

export {
  notificationEventKeys,
  type CancelScheduledDeliveriesInput,
  type NotificationDispatchInput,
  type NotificationDispatchRecipient,
  type NotificationDispatchResult,
  type NotificationEventKey,
  type NotificationResource,
} from '@/server/services/notification-dispatcher'

interface NotificationData {
  userId: string
  type: string
  title: string
  message: string
  relatedId?: string
  eventKey?: string
  dedupeKey?: string
  resourceType?: string
  resourceId?: string
  actionUrl?: string
  priority?: NotificationPriority
}

type AssessmentSubmissionNotification = {
  userId: string
  courseId: string
  submissionId: string
  assessmentType: 'COURSE_TEST' | 'FINAL_EXAM'
  requiresReview: boolean
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
    eventKey,
    dedupeKey,
    resourceType,
    resourceId,
    actionUrl,
    priority,
  }: NotificationData) {
    try {
      const notification = await db.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          relatedId,
          ...(eventKey ? { eventKey } : {}),
          ...(dedupeKey ? { dedupeKey } : {}),
          ...(resourceType ? { resourceType } : {}),
          ...(resourceId ? { resourceId } : {}),
          ...(actionUrl ? { actionUrl } : {}),
          ...(priority ? { priority } : {}),
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
        data: { isRead: true, readAt: new Date() },
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
        data: { isRead: true, readAt: new Date() },
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
   * Central P1 dispatch entry point. It returns an error result rather than
   * throwing, so callers can invoke it after a business mutation without
   * rolling that mutation back when notification infrastructure is unavailable.
   */
  static async dispatch(input: NotificationDispatchInput) {
    return dispatchNotification(input)
  }

  /**
   * Cancels only future deliveries for an explicit resource/event/dedupe scope.
   */
  static async cancelScheduledDeliveries(input: CancelScheduledDeliveriesInput) {
    return cancelScheduledNotificationDeliveries(input)
  }

  /**
   * Used only by the outbox worker after it has claimed an IN_APP delivery.
   * It throws on persistence failure so the worker can retry the delivery.
   */
  static async materializeInAppDelivery(delivery: PendingInAppDelivery, now?: Date) {
    return materializeInAppNotificationDelivery(delivery, now)
  }

  /**
   * A terminal outbox failure should be visible to admins but must not enqueue
   * another email and create a notification-delivery retry loop.
   */
  static async notifyDeliveryExhausted(input: {
    deliveryId: string
    eventKey: string
    resource?: { type: string; id: string }
  }) {
    try {
      const admins = await db.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      })

      return this.dispatch({
        eventKey: 'notification.delivery_exhausted',
        type: 'SYSTEM',
        title: 'No se pudo entregar una notificación',
        message: `La notificación ${input.eventKey} agotó sus reintentos de entrega.`,
        recipients: admins.map((admin) => ({ userId: admin.id })),
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: input.resource,
        priority: NotificationPriority.HIGH,
        dedupeKey: `notification-delivery:${input.deliveryId}:exhausted`,
      })
    } catch (error) {
      console.error('Error notifying admins about exhausted delivery:', error)
      return {
        ok: false as const,
        notifications: 0,
        deliveries: 0,
        error: 'NOTIFICATION_DISPATCH_FAILED' as const,
      }
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
          where: {
            courseId: targetId,
            ...buildActiveCourseAccessWhere(),
          },
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
        NO_SHOW: {
          title: 'Inasistencia registrada',
          message: `Tu cita de "${serviceName}" fue marcada como no asistida`,
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
   * Alert the staff member assigned to an appointment once its payment confirms.
   */
  static async triggerOnPaidAppointmentConfirmation(
    staffId: string,
    appointmentId: string,
    serviceName: string,
    customerName: string,
  ) {
    try {
      await this.createNotification({
        userId: staffId,
        type: 'APPOINTMENT',
        title: 'Cita pagada confirmada',
        message: `${customerName} confirmó el pago de su cita de "${serviceName}"`,
        relatedId: appointmentId,
      })
    } catch (error) {
      console.error('Error triggering paid appointment notification:', error)
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
    excludeUserIds = [],
  }: {
    type: string
    title: string
    message: string
    relatedId?: string
    excludeUserIds?: string[]
  }) {
    try {
      const admins = await db.user.findMany({
        where: {
          role: 'ADMIN',
          ...(excludeUserIds.length > 0 ? { id: { notIn: excludeUserIds } } : {}),
        },
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
   * Persist an acknowledgement for a student assessment submission and, when
   * human review is required, alert every administrator who can review it.
   */
  static async triggerOnAssessmentSubmission({
    userId,
    courseId,
    submissionId,
    assessmentType,
    requiresReview,
  }: AssessmentSubmissionNotification) {
    try {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      })
      const courseName = course?.title ?? 'tu curso'
      const assessmentLabel = assessmentType === 'FINAL_EXAM' ? 'examen final' : 'evaluación'
      const received = assessmentType === 'FINAL_EXAM' ? 'recibido' : 'recibida'

      await this.createNotification({
        userId,
        type: 'SUBMISSION',
        title: 'Entrega recibida',
        message: `Tu ${assessmentLabel} de "${courseName}" fue ${received}${
          requiresReview ? ' y está pendiente de revisión.' : '.'
        }`,
        relatedId: submissionId,
      })

      if (requiresReview) {
        await this.notifyAllAdmins({
          type: 'SUBMISSION',
          title: 'Nueva entrega pendiente de revisión',
          message: `Se recibió un ${assessmentLabel} de "${courseName}" para revisión.`,
          relatedId: submissionId,
        })
      }
    } catch (error) {
      console.error('Error triggering assessment submission notification:', error)
      // Don't throw - a notification must not make a valid submission fail.
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
