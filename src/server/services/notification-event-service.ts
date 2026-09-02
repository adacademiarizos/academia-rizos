import {
  NotificationDeliveryChannel,
  NotificationPreferenceCategory,
  NotificationPriority,
} from "@prisma/client";

import { db } from "@/lib/db";
import {
  dispatchNotification,
  cancelScheduledNotificationDeliveries,
  type NotificationDispatchRecipient,
} from "@/server/services/notification-dispatcher";

type AccountRecipient = {
  id: string;
  email?: string | null;
};

type AppointmentRecipient = AccountRecipient & {
  name?: string | null;
};

type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED";

export type PaymentReceiptQueueResult = {
  /** The receipt NotificationDelivery row was persisted (or already existed). */
  queued: boolean;
  /** The legacy receipt marker was persisted, or was already present. */
  markerRecorded: boolean;
  error?: string;
};

const appointmentStatusCopy: Record<AppointmentStatus, { title: string; message: (serviceName: string) => string }> = {
  PENDING: {
    title: "Cita en espera",
    message: (serviceName) => `Tu cita de \"${serviceName}\" está en espera de confirmación.`,
  },
  CONFIRMED: {
    title: "Cita confirmada",
    message: (serviceName) => `Tu cita de \"${serviceName}\" fue confirmada.`,
  },
  CANCELLED: {
    title: "Cita cancelada",
    message: (serviceName) => `Tu cita de \"${serviceName}\" fue cancelada.`,
  },
  NO_SHOW: {
    title: "Inasistencia registrada",
    message: (serviceName) => `Tu cita de \"${serviceName}\" fue marcada como no asistida.`,
  },
  COMPLETED: {
    title: "Cita completada",
    message: (serviceName) => `Tu cita de \"${serviceName}\" fue marcada como completada.`,
  },
};

function accountChannels(recipient: AccountRecipient): NotificationDeliveryChannel[] {
  return recipient.email
    ? [NotificationDeliveryChannel.IN_APP, NotificationDeliveryChannel.EMAIL]
    : [NotificationDeliveryChannel.IN_APP];
}

function emailRecipient(email: string | null | undefined): NotificationDispatchRecipient[] {
  return email ? [{ email, channels: [NotificationDeliveryChannel.EMAIL] }] : [];
}

async function getAdmins(excludeUserIds: string[] = []) {
  return db.user.findMany({
    where: {
      role: "ADMIN",
      ...(excludeUserIds.length > 0 ? { id: { notIn: excludeUserIds } } : {}),
    },
    select: { id: true, email: true },
  });
}

async function getAccountRecipient(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
}

/**
 * The only semantic notification entry point used by business endpoints.
 * It owns the recipient matrix, priority, URLs and channel choice; callers
 * provide domain facts only. Dispatch failures are intentionally isolated
 * from the payment, booking, review or account mutation that emitted them.
 */
export class NotificationEventService {
  static async appointmentRequested(input: {
    appointmentId: string;
    serviceName: string;
    customerName: string;
    staff: AppointmentRecipient;
    customer?: AppointmentRecipient | null;
    customerEmail?: string | null;
  }) {
    try {
      const eventDedupeKey = `appointment:${input.appointmentId}:requested`;
      const customerRecipients = input.customer
        ? [{ userId: input.customer.id, email: input.customer.email ?? undefined, channels: accountChannels(input.customer) }]
        : emailRecipient(input.customerEmail);
      await Promise.all([
        dispatchNotification({
          eventKey: "appointment.requested",
          type: "APPOINTMENT",
          title: "Nueva solicitud de cita",
          message: `${input.customerName} solicitó una cita de \"${input.serviceName}\".`,
          recipients: [{ userId: input.staff.id }],
          channels: [NotificationDeliveryChannel.IN_APP],
          resource: { type: "APPOINTMENT", id: input.appointmentId },
          actionUrl: "/staff/appointments",
          priority: NotificationPriority.HIGH,
          dedupeKey: eventDedupeKey,
        }),
        ...(customerRecipients.length
          ? [
              dispatchNotification({
                eventKey: "appointment.requested",
                type: "APPOINTMENT",
                title: "Solicitud de cita recibida",
                message: `Recibimos tu solicitud de cita de \"${input.serviceName}\".`,
                recipients: customerRecipients,
                resource: { type: "APPOINTMENT", id: input.appointmentId },
                actionUrl: "/booking",
                priority: NotificationPriority.HIGH,
                dedupeKey: eventDedupeKey,
              }),
            ]
          : []),
      ]);
    } catch (error) {
      console.error("[notifications] appointment request event failed", error);
    }
  }

  static async appointmentPaid(input: {
    appointmentId: string;
    paymentId: string;
    serviceName: string;
    customerName: string;
    customer?: AppointmentRecipient | null;
    customerEmail?: string | null;
    staff: AppointmentRecipient;
  }) {
    try {
      const admins = await getAdmins([input.staff.id]);
      const eventDedupeKey = `appointment:${input.appointmentId}:paid:${input.paymentId}`;
      const customerRecipients = input.customer
        ? [{ userId: input.customer.id, email: input.customer.email ?? undefined, channels: accountChannels(input.customer) }]
        : emailRecipient(input.customerEmail);

      await Promise.all([
        ...(customerRecipients.length
          ? [
              dispatchNotification({
                eventKey: "appointment.paid",
                type: "APPOINTMENT",
                title: "Cita confirmada",
                message: `Tu cita de \"${input.serviceName}\" fue confirmada.`,
                recipients: customerRecipients,
                resource: { type: "APPOINTMENT", id: input.appointmentId },
                actionUrl: "/booking",
                priority: NotificationPriority.HIGH,
                dedupeKey: eventDedupeKey,
              }),
            ]
          : []),
        dispatchNotification({
          eventKey: "appointment.paid",
          type: "APPOINTMENT",
          title: "Cita pagada confirmada",
          message: `${input.customerName} confirmó el pago de su cita de \"${input.serviceName}\".`,
          recipients: [{ userId: input.staff.id, email: input.staff.email ?? undefined, channels: accountChannels(input.staff) }],
          resource: { type: "APPOINTMENT", id: input.appointmentId },
          actionUrl: "/staff/appointments",
          priority: NotificationPriority.HIGH,
          dedupeKey: eventDedupeKey,
        }),
        ...(admins.length
          ? [
              dispatchNotification({
                eventKey: "appointment.paid",
                type: "APPOINTMENT",
                title: "Nueva cita pagada",
                message: `${input.customerName} confirmó su cita de \"${input.serviceName}\".`,
                recipients: admins.map((admin) => ({ userId: admin.id })),
                channels: [NotificationDeliveryChannel.IN_APP],
                resource: { type: "APPOINTMENT", id: input.appointmentId },
                actionUrl: "/admin/appointments",
                priority: NotificationPriority.HIGH,
                dedupeKey: eventDedupeKey,
              }),
            ]
          : []),
      ]);
    } catch (error) {
      console.error("[notifications] paid appointment event failed", error);
    }
  }

  static async appointmentStatusChanged(input: {
    appointmentId: string;
    status: AppointmentStatus;
    serviceName: string;
    transitionId: string;
    customer?: AppointmentRecipient | null;
    customerEmail?: string | null;
    staff: AppointmentRecipient;
  }) {
    try {
      const copy = appointmentStatusCopy[input.status];
      const eventDedupeKey = `appointment:${input.appointmentId}:status:${input.status}:${input.transitionId}`;
      const customerRecipients = input.customer
        ? [{ userId: input.customer.id, email: input.customer.email ?? undefined, channels: accountChannels(input.customer) }]
        : emailRecipient(input.customerEmail);
      const invalidatesFutureAgenda = ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(input.status);

      // This is a state-maintenance concern, not a best-effort delivery: run
      // it before querying recipients so a notification query outage cannot
      // leave reminders active for an invalidated appointment.
      if (invalidatesFutureAgenda) {
        await cancelScheduledNotificationDeliveries({
          resource: { type: "APPOINTMENT", id: input.appointmentId },
        });
      }

      // ADMIN supervises appointment closures and no-shows, but routine state
      // changes remain scoped to the assigned staff member and customer.
      const admins = ["CANCELLED", "NO_SHOW"].includes(input.status)
        ? await getAdmins([input.staff.id])
        : [];

      await Promise.all([
        dispatchNotification({
          eventKey: "appointment.status_changed",
          type: "APPOINTMENT",
          title: copy.title,
          message: copy.message(input.serviceName),
          recipients: [{ userId: input.staff.id, email: input.staff.email ?? undefined, channels: accountChannels(input.staff) }],
          resource: { type: "APPOINTMENT", id: input.appointmentId },
          actionUrl: "/staff/appointments",
          priority: input.status === "CANCELLED" || input.status === "NO_SHOW" ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
          dedupeKey: eventDedupeKey,
        }),
        ...(customerRecipients.length
          ? [
              dispatchNotification({
                eventKey: "appointment.status_changed",
                type: "APPOINTMENT",
                title: copy.title,
                message: copy.message(input.serviceName),
                recipients: customerRecipients,
                resource: { type: "APPOINTMENT", id: input.appointmentId },
                actionUrl: "/booking",
                priority: input.status === "CANCELLED" || input.status === "NO_SHOW" ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
                dedupeKey: eventDedupeKey,
              }),
            ]
          : []),
        ...(admins.length
          ? [
              dispatchNotification({
                eventKey: "appointment.status_changed",
                type: "APPOINTMENT",
                title: copy.title,
                message: `La cita de "${input.serviceName}" requiere seguimiento: ${copy.message(input.serviceName)}`,
                recipients: admins.map((admin) => ({ userId: admin.id })),
                channels: [NotificationDeliveryChannel.IN_APP],
                resource: { type: "APPOINTMENT", id: input.appointmentId },
                actionUrl: "/admin/appointments",
                priority: NotificationPriority.HIGH,
                dedupeKey: eventDedupeKey,
              }),
            ]
          : []),
      ]);

    } catch (error) {
      console.error("[notifications] appointment status event failed", error);
    }
  }

  static async paymentLinkLifecycle(input: {
    eventKey: "payment_link.paid" | "payment_link.expired" | "payment_link.failed" | "payment_link.refunded";
    paymentLinkId: string;
    paymentId: string;
    title: string;
    amountLabel?: string;
    createdById: string;
  }) {
    try {
      const owner = await getAccountRecipient(input.createdById);
      if (!owner) return;

      const copy = {
        "payment_link.paid": {
          title: "Pago recibido",
          message: `Se pagó tu link \"${input.title}\"${input.amountLabel ? ` por ${input.amountLabel}` : ""}.`,
        },
        "payment_link.expired": {
          title: "Link de pago expirado",
          message: `El checkout de tu link \"${input.title}\" expiró sin completarse.`,
        },
        "payment_link.failed": {
          title: "Pago de link fallido",
          message: `No se pudo completar el pago de tu link \"${input.title}\".`,
        },
        "payment_link.refunded": {
          title: "Pago de link reembolsado",
          message: `El pago de tu link \"${input.title}\" fue reembolsado.`,
        },
      }[input.eventKey];
      const actionUrl = owner.role === "ADMIN" ? "/admin/payment-links" : "/staff/payment-links";

      await dispatchNotification({
        eventKey: input.eventKey,
        type: "PAYMENT",
        title: copy.title,
        message: copy.message,
        recipients: [{ userId: owner.id, email: owner.email, channels: accountChannels(owner) }],
        resource: { type: "PAYMENT_LINK", id: input.paymentLinkId },
        actionUrl,
        priority: input.eventKey === "payment_link.failed" || input.eventKey === "payment_link.refunded" ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
        dedupeKey: `payment-link:${input.paymentLinkId}:${input.eventKey}:${input.paymentId}`,
      });

      // A payment link may be created by non-admin staff; admins are broadcast
      // a lighter-weight in-app alert on payment so they retain payments
      // visibility without duplicating the owner's actionable notification.
      if (input.eventKey === "payment_link.paid") {
        const admins = await getAdmins([input.createdById]);
        if (admins.length > 0) {
          await dispatchNotification({
            eventKey: input.eventKey,
            type: "PAYMENT",
            title: "Nuevo pago recibido",
            message: `Pago de ${input.amountLabel ?? "un link de pago"} — ${copy.title.toLowerCase()}: "${input.title}"`,
            recipients: admins.map((admin) => ({ userId: admin.id })),
            channels: [NotificationDeliveryChannel.IN_APP],
            resource: { type: "PAYMENT_LINK", id: input.paymentLinkId },
            actionUrl: "/admin/payment-links",
            priority: NotificationPriority.NORMAL,
            dedupeKey: `payment-link:${input.paymentLinkId}:${input.eventKey}:${input.paymentId}:admin`,
          });
        }
      }
    } catch (error) {
      console.error("[notifications] payment link event failed", error);
    }
  }

  static async paymentException(input: {
    eventKey: "payment.failed" | "payment.refunded" | "payment.dispute_created" | "payment.dispute_closed";
    paymentId: string;
    title: string;
    message: string;
    actionUrl?: string;
    priority?: NotificationPriority;
  }) {
    try {
      const admins = await getAdmins();
      if (admins.length === 0) return;

      await dispatchNotification({
        eventKey: input.eventKey,
        type: input.eventKey.startsWith("payment.dispute") ? "DISPUTE" : "PAYMENT",
        title: input.title,
        message: input.message,
        recipients: admins.map((admin) => ({
          userId: admin.id,
          email: admin.email,
          channels: [NotificationDeliveryChannel.IN_APP, NotificationDeliveryChannel.EMAIL],
        })),
        resource: { type: "PAYMENT", id: input.paymentId },
        actionUrl: input.actionUrl ?? "/admin/payment-links",
        priority: input.priority ?? NotificationPriority.HIGH,
        dedupeKey: `payment:${input.paymentId}:${input.eventKey}`,
      });
    } catch (error) {
      console.error("[notifications] payment exception event failed", error);
    }
  }

  static async paymentForPayer(input: {
    eventKey: "payment.failed" | "payment.refunded";
    paymentId: string;
    title: string;
    message: string;
    payer?: AccountRecipient | null;
    payerEmail?: string | null;
    actionUrl: string;
  }) {
    try {
      const recipients = input.payer
        ? [{ userId: input.payer.id, email: input.payer.email ?? undefined, channels: accountChannels(input.payer) }]
        : emailRecipient(input.payerEmail);
      if (recipients.length === 0) return;

      await dispatchNotification({
        eventKey: input.eventKey,
        type: "PAYMENT",
        title: input.title,
        message: input.message,
        recipients,
        resource: { type: "PAYMENT", id: input.paymentId },
        actionUrl: input.actionUrl,
        priority: NotificationPriority.HIGH,
        dedupeKey: `payment:${input.paymentId}:${input.eventKey}:payer`,
      });
    } catch (error) {
      console.error("[notifications] payer payment event failed", error);
    }
  }

  static async paymentReceipt(input: {
    paymentId: string;
    concept: string;
    amountLabel: string;
    payer?: AccountRecipient | null;
    payerEmail?: string | null;
    actionUrl: string;
  }): Promise<PaymentReceiptQueueResult> {
    const recipientEmail = input.payerEmail?.trim() || input.payer?.email?.trim();
    const recipients = recipientEmail
      ? [
          {
            ...(input.payer ? { userId: input.payer.id } : {}),
            email: recipientEmail,
            channels: [NotificationDeliveryChannel.EMAIL],
          },
        ]
      : [];

    if (recipients.length === 0) {
      return {
        queued: false,
        markerRecorded: false,
        error: "Receipt recipient email is required",
      };
    }

    try {
      const dispatchResult = await dispatchNotification({
        eventKey: "payment.receipt",
        type: "PAYMENT",
        title: "Recibo de pago",
        message: `Recibimos tu pago de ${input.concept.toLowerCase()} por ${input.amountLabel}.`,
        recipients,
        resource: { type: "PAYMENT", id: input.paymentId },
        actionUrl: input.actionUrl,
        priority: NotificationPriority.NORMAL,
        dedupeKey: `payment:${input.paymentId}:receipt`,
      });

      if (!dispatchResult.ok) {
        return {
          queued: false,
          markerRecorded: false,
          error: dispatchResult.error,
        };
      }

      // This legacy field now means "the durable receipt outbox row exists".
      // The email worker alone records actual delivery in NotificationDelivery.
      try {
        await db.payment.updateMany({
          where: { id: input.paymentId, receiptEmailSentAt: null },
          data: {
            receiptEmailSentAt: new Date(),
            receiptToEmail: recipientEmail,
          },
        });

        return { queued: true, markerRecorded: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[notifications] receipt outbox marker failed", error);
        return {
          queued: true,
          markerRecorded: false,
          error: `Failed to record receipt outbox marker: ${message}`,
        };
      }
    } catch (error) {
      console.error("[notifications] payment receipt event failed", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        queued: false,
        markerRecorded: false,
        error: `Failed to queue payment receipt: ${message}`,
      };
    }
  }

  static async coursePublished(input: {
    courseId: string;
    courseTitle: string;
    recipientUserIds: string[];
    publicationId: string;
  }) {
    if (input.recipientUserIds.length === 0) return;

    await dispatchNotification({
      eventKey: "course.published",
      type: "NEW_COURSE",
      title: "Nuevo contenido disponible",
      message: `\"${input.courseTitle}\" se publicó en la academia.`,
      recipients: input.recipientUserIds.map((userId) => ({ userId })),
      resource: { type: "COURSE", id: input.courseId },
      actionUrl: `/learn/${input.courseId}`,
      priority: NotificationPriority.NORMAL,
      preferenceCategory: NotificationPreferenceCategory.COURSE_UPDATES,
      dedupeKey: `course:${input.courseId}:published:${input.publicationId}`,
    });
  }

  /**
   * Achievements are optional, student-only in-app recognition. They never
   * represent a notification for an individual like or other raw activity.
   */
  static async achievementEarned(input: {
    achievementId: string;
    userId: string;
    achievementName: string;
  }) {
    try {
      const student = await getAccountRecipient(input.userId);
      if (!student || student.role !== "STUDENT") return;

      await dispatchNotification({
        eventKey: "achievement.earned",
        type: "ACHIEVEMENT",
        title: "¡Nuevo logro desbloqueado!",
        message: `Obtuviste el logro "${input.achievementName}".`,
        recipients: [{ userId: student.id }],
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: "ACHIEVEMENT", id: input.achievementId },
        actionUrl: "/student",
        priority: NotificationPriority.LOW,
        preferenceCategory: NotificationPreferenceCategory.ACHIEVEMENTS,
        dedupeKey: `achievement:${input.achievementId}:earned`,
      });
    } catch (error) {
      console.error("[notifications] achievement event failed", error);
    }
  }

  static async courseAccessGranted(input: {
    accessId: string;
    userId: string;
    courseId: string;
    courseTitle: string;
    accessUntil: Date | null;
  }) {
    await dispatchNotification({
      eventKey: "course.access_granted",
      type: "PAYMENT",
      title: "¡Acceso otorgado!",
      message: `Ahora tienes acceso a \"${input.courseTitle}\".`,
      recipients: [{ userId: input.userId }],
      channels: [NotificationDeliveryChannel.IN_APP],
      resource: { type: "COURSE_ACCESS", id: input.accessId },
      relatedId: input.courseId,
      actionUrl: `/learn/${input.courseId}`,
      priority: NotificationPriority.NORMAL,
      dedupeKey: `course-access:${input.accessId}:granted:${input.accessUntil?.toISOString() ?? "lifetime"}`,
    });
  }

  /**
   * D-14: notifies a student that an admin granted extra attempt(s) on an
   * assessment/lesson test/final exam revalidation. Reuses dispatchNotification
   * — in-app row now, EMAIL queued PENDING for the delivery job. Never throws:
   * dispatch failure is logged by the dispatcher, not propagated, so the
   * grant itself always stands regardless of notification outcome.
   */
  static async attemptsGranted(input: {
    userId: string;
    courseId: string;
    revalidationId: string;
    targetTitle: string;
    attemptsGranted: number;
    actionUrl: string;
  }) {
    try {
      const student = await getAccountRecipient(input.userId);
      if (!student) return;

      await dispatchNotification({
        eventKey: "academy.attempts.granted",
        type: "ACADEMY",
        title: "Nuevo intento habilitado",
        message: `Te habilitaron ${input.attemptsGranted} intento${input.attemptsGranted === 1 ? "" : "s"} más para "${input.targetTitle}".`,
        recipients: [{ userId: student.id, email: student.email ?? undefined, channels: accountChannels(student) }],
        resource: { type: "REVALIDATION", id: input.revalidationId },
        relatedId: input.courseId,
        actionUrl: input.actionUrl,
        priority: NotificationPriority.HIGH,
        preferenceCategory: NotificationPreferenceCategory.COURSE_UPDATES,
        dedupeKey: `revalidation:${input.revalidationId}:granted`,
      });
    } catch (error) {
      console.error("[notifications] attempts granted event failed", error);
    }
  }

  static async courseAccessRevoked(input: {
    accessId: string;
    userId: string;
    courseId: string;
    courseTitle: string;
  }) {
    await dispatchNotification({
      eventKey: "course.access_revoked",
      type: "PAYMENT",
      title: "Acceso revocado",
      message: `Tu acceso a \"${input.courseTitle}\" fue revocado porque el pago ya no es válido.`,
      recipients: [{ userId: input.userId }],
      channels: [NotificationDeliveryChannel.IN_APP],
      resource: { type: "COURSE_ACCESS", id: input.accessId },
      relatedId: input.courseId,
      actionUrl: `/courses/${input.courseId}`,
      priority: NotificationPriority.HIGH,
      dedupeKey: `course-access:${input.accessId}:revoked`,
    });
  }

  static async userRegistered(userId: string, provider?: "Google" | "contraseña") {
    try {
      const admins = await getAdmins();
      if (admins.length === 0) return;
      await dispatchNotification({
        eventKey: "user.registered",
        type: "NEW_USER",
        title: "Nuevo usuario registrado",
        message: `Un usuario se registró${provider ? ` con ${provider}` : ""}.`,
        recipients: admins.map((admin) => ({ userId: admin.id })),
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: "USER", id: userId },
        actionUrl: "/admin/users",
        priority: NotificationPriority.LOW,
        dedupeKey: `user:${userId}:registered`,
      });
    } catch (error) {
      console.error("[notifications] user registration event failed", error);
    }
  }

  static async roleChanged(input: { userId: string; previousRole: string; nextRole: string }) {
    try {
      const user = await getAccountRecipient(input.userId);
      if (!user) return;

      await dispatchNotification({
        eventKey: "user.role_changed",
        type: "ROLE_CHANGE",
        title: "Tu rol ha cambiado",
        message: `Tu rol fue actualizado de ${input.previousRole} a ${input.nextRole}.`,
        recipients: [{ userId: user.id, email: user.email, channels: accountChannels(user) }],
        resource: { type: "USER", id: user.id },
        actionUrl: `/profile/${user.id}`,
        priority: NotificationPriority.HIGH,
        dedupeKey: `user:${user.id}:role:${input.previousRole}:${input.nextRole}`,
      });
    } catch (error) {
      console.error("[notifications] role changed event failed", error);
    }
  }

  static async bugReportCreated(input: {
    reportId: string;
    reporter: AccountRecipient;
    reporterName: string;
    title: string;
    bugType: "CONTENT" | "FUNCTIONALITY";
  }) {
    try {
      const admins = await getAdmins();
      await Promise.all([
        dispatchNotification({
          eventKey: "bug_report.acknowledged",
          type: "BUG_REPORT",
          title: "Reporte recibido",
          message: "Recibimos tu reporte y lo revisaremos.",
          recipients: [{ userId: input.reporter.id }],
          channels: [NotificationDeliveryChannel.IN_APP],
          resource: { type: "BUG_REPORT", id: input.reportId },
          priority: NotificationPriority.NORMAL,
          dedupeKey: `bug-report:${input.reportId}:acknowledged`,
        }),
        ...(admins.length
          ? [
              dispatchNotification({
                eventKey: "bug_report.created",
                type: "BUG_REPORT",
                title: `Nuevo reporte de bug: ${input.bugType}`,
                message: `${input.reporterName} reportó: ${input.title}`,
                recipients: admins.map((admin) => ({
                  userId: admin.id,
                  email: admin.email,
                  channels:
                    input.bugType === "FUNCTIONALITY"
                      ? [NotificationDeliveryChannel.IN_APP, NotificationDeliveryChannel.EMAIL]
                      : [NotificationDeliveryChannel.IN_APP],
                })),
                resource: { type: "BUG_REPORT", id: input.reportId },
                actionUrl: "/admin",
                priority: input.bugType === "FUNCTIONALITY" ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
                dedupeKey: `bug-report:${input.reportId}:created`,
              }),
            ]
          : []),
      ]);
    } catch (error) {
      console.error("[notifications] bug report event failed", error);
    }
  }
}
