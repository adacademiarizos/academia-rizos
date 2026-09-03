/**
 * NotificationService
 * Handles creation, retrieval, and management of user notifications
 */

import { db } from '@/lib/db'
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
  /** Revalidation version for legacy upsert-based submissions. */
  submissionVersion?: string
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
   * @deprecated Community notifications are intentionally direct-only. New
   * code must use CommunityNotificationService for validated replies/mentions.
   * This no-op keeps legacy callers from restoring the former course broadcast.
   */
  static async triggerOnComment(
    _commenterId: string,
    _commentId: string,
    _targetType: string,
    _targetId: string
  ) {
    void [_commenterId, _commentId, _targetType, _targetId]
    return undefined
  }

  /**
   * @deprecated Likes are an activity signal only and never send a recipient
   * notification. Retained as a no-op for backwards compatibility.
   */
  static async triggerOnLike(
    _likerId: string,
    _targetType: string,
    _targetId: string
  ) {
    void [_likerId, _targetType, _targetId]
    return undefined
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

      await this.dispatch({
        eventKey: 'certificate.issued',
        type: 'CERTIFICATE',
        title: '¡Certificado disponible!',
        message: `Tu certificado de "${course.title}" está listo para descargar.`,
        recipients: [{ userId }],
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: 'CERTIFICATE', id: `${userId}:${courseId}` },
        // The course page has no certificate on it; sending the student there
        // made "disponible" a dead end.
        actionUrl: '/student/certificates',
        priority: NotificationPriority.HIGH,
        dedupeKey: `certificate:${userId}:${courseId}:issued`,
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

      await this.dispatch({
        eventKey: 'certificate.revoked',
        type: 'CERTIFICATE',
        title: 'Certificado revocado',
        message: `Tu certificado de "${course?.title ?? 'un curso'}" fue revocado por un administrador.`,
        recipients: [{ userId }],
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: 'CERTIFICATE', id: `${userId}:${courseId}` },
        actionUrl: `/learn/${courseId}`,
        priority: NotificationPriority.HIGH,
        dedupeKey: `certificate:${userId}:${courseId}:revoked`,
      })
    } catch (error) {
      console.error('Error triggering certificate revoked notification:', error)
      // Don't throw
    }
  }

  /** Alert the review queue only when a pending certificate record is created. */
  static async triggerOnCertificatePendingReview(input: {
    certificateId: string
    userId: string
    courseId: string
  }) {
    try {
      const [student, course, admins] = await Promise.all([
        db.user.findUnique({
          where: { id: input.userId },
          select: { name: true, email: true },
        }),
        db.course.findUnique({
          where: { id: input.courseId },
          select: { title: true },
        }),
        db.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true },
        }),
      ])
      if (!course || admins.length === 0) return

      await this.dispatch({
        eventKey: 'certificate.pending',
        type: 'CERTIFICATE',
        title: 'Certificado pendiente de revisión',
        message: `${student?.name ?? student?.email ?? 'Un estudiante'} completó el flujo sin examen final y requiere revisión para "${course.title}".`,
        recipients: admins.map((admin) => ({ userId: admin.id })),
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: 'CERTIFICATE', id: input.certificateId },
        actionUrl: '/admin/courses/certificates',
        priority: NotificationPriority.HIGH,
        dedupeKey: `certificate:${input.certificateId}:pending-review`,
      })
    } catch (error) {
      console.error('Error triggering pending certificate notification:', error)
    }
  }

  /**
   * Trigger notification when an exam submission is reviewed
   */
  static async triggerOnExamReview(
    userId: string,
    courseId: string,
    status: 'APPROVED' | 'REVISION_REQUESTED',
    reviewNote?: string | null,
    submissionId?: string,
    reviewVersion?: string,
  ) {
    try {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      })

      const courseName = course?.title ?? 'tu curso'

      const approved = status === 'APPROVED'
      await this.dispatch({
        eventKey: 'academy.review.completed',
        type: 'EXAM_REVIEW',
        title: approved ? '¡Examen aprobado!' : 'Revisión solicitada en tu examen',
        message: approved
          ? `Tu examen de "${courseName}" fue aprobado. Recibirás tu certificado en breve.`
          : reviewNote
            ? `Tu examen de "${courseName}" necesita revisiones: ${reviewNote}`
            : `Tu examen de "${courseName}" necesita algunas correcciones.`,
        recipients: [{ userId }],
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: 'ASSESSMENT_SUBMISSION', id: submissionId ?? `${courseId}:exam` },
        actionUrl: `/learn/${courseId}`,
        priority: NotificationPriority.HIGH,
        dedupeKey: `academy-review:${submissionId ?? `${courseId}:exam`}:${status}:${reviewVersion ?? reviewNote ?? 'initial'}`,
      })
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
    submissionId?: string,
    reviewVersion?: string,
  ) {
    try {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      })

      const courseName = course?.title ?? 'tu curso'

      const approved = status === 'APPROVED'
      const assessmentLabel = isFinalExam ? 'examen final' : 'evaluación'
      await this.dispatch({
        eventKey: 'academy.review.completed',
        type: 'EXAM_REVIEW',
        title: approved
          ? isFinalExam ? '¡Examen final aprobado!' : '¡Evaluación aprobada!'
          : 'Revisión solicitada',
        message: approved
          ? isFinalExam
            ? `Tu examen final de "${courseName}" fue aprobado. Tu certificado está listo.`
            : `Tu evaluación de "${courseName}" fue aprobada. ¡Buen trabajo!`
          : `Tu evaluación de "${courseName}" necesita algunas correcciones.`,
        recipients: [{ userId }],
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: 'ASSESSMENT_SUBMISSION', id: submissionId ?? `${courseId}:${assessmentLabel}` },
        actionUrl: `/learn/${courseId}`,
        priority: NotificationPriority.HIGH,
        dedupeKey: `academy-review:${submissionId ?? `${courseId}:${assessmentLabel}`}:${status}:${reviewVersion ?? 'initial'}`,
      })
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
    submissionVersion,
  }: AssessmentSubmissionNotification) {
    try {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      })
      const courseName = course?.title ?? 'tu curso'
      const assessmentLabel = assessmentType === 'FINAL_EXAM' ? 'examen final' : 'evaluación'
      const received = assessmentType === 'FINAL_EXAM' ? 'recibido' : 'recibida'

      await this.dispatch({
        eventKey: 'academy.submission.received',
        type: 'SUBMISSION',
        title: 'Entrega recibida',
        message: `Tu ${assessmentLabel} de "${courseName}" fue ${received}${
          requiresReview ? ' y está pendiente de revisión.' : '.'
        }`,
        recipients: [{ userId }],
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: 'ASSESSMENT_SUBMISSION', id: submissionId },
        actionUrl: `/learn/${courseId}`,
        priority: NotificationPriority.NORMAL,
        dedupeKey: `academy-submission:${submissionId}:${submissionVersion ?? 'initial'}:received`,
      })

      if (requiresReview) {
        const admins = await db.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true },
        })
        await this.dispatch({
          eventKey: 'academy.submission.pending_review',
          type: 'SUBMISSION',
          title: 'Nueva entrega pendiente de revisión',
          message: `Se recibió un ${assessmentLabel} de "${courseName}" para revisión.`,
          recipients: admins.map((admin) => ({ userId: admin.id })),
          channels: [NotificationDeliveryChannel.IN_APP],
          resource: { type: 'ASSESSMENT_SUBMISSION', id: submissionId },
          actionUrl: '/admin/courses/review',
          priority: NotificationPriority.HIGH,
          dedupeKey: `academy-submission:${submissionId}:${submissionVersion ?? 'initial'}:pending-review`,
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
        select: { name: true, email: true },
      })

      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      })

      if (!user || !course?.title) return

      const admins = await db.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      })

      // The progress roadmap is the only caller allowed to invoke this after
      // a final assessment/certificate workflow; module progress must not.
      await Promise.all([
        this.dispatch({
          eventKey: 'academy.course.completed',
          type: 'COURSE_COMPLETION',
          title: '¡Curso finalizado!',
          message: `Felicidades, completaste "${course.title}".`,
          recipients: [{ userId }],
          channels: [NotificationDeliveryChannel.IN_APP],
          resource: { type: 'COURSE', id: courseId },
          actionUrl: `/learn/${courseId}`,
          priority: NotificationPriority.HIGH,
          dedupeKey: `course:${courseId}:user:${userId}:completed`,
        }),
        ...(admins.length
          ? [
              this.dispatch({
                eventKey: 'academy.course.completed',
                type: 'COURSE_COMPLETION',
                title: 'Finalización académica confirmada',
                message: `${user.name ?? user.email} finalizó "${course.title}" tras aprobar el flujo final.`,
                recipients: admins.map((admin) => ({ userId: admin.id })),
                channels: [NotificationDeliveryChannel.IN_APP],
                resource: { type: 'COURSE', id: courseId },
                actionUrl: '/admin/courses/review',
                priority: NotificationPriority.HIGH,
                dedupeKey: `course:${courseId}:user:${userId}:completed`,
              }),
            ]
          : []),
      ])
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

      await this.dispatch({
        eventKey: 'course.access_granted',
        type: 'PAYMENT',
        title: '¡Acceso otorgado!',
        message: `Ahora tienes acceso a "${course.title}".`,
        recipients: [{ userId }],
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: 'COURSE', id: courseId },
        actionUrl: `/learn/${courseId}`,
        priority: NotificationPriority.NORMAL,
        dedupeKey: `course:${courseId}:user:${userId}:access-granted`,
      })
    } catch (error) {
      console.error('Error triggering enrollment notification:', error)
      // Don't throw
    }
  }
}
