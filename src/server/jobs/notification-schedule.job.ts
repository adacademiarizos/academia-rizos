import {
  AppointmentStatus,
  NotificationDeliveryChannel,
  NotificationPriority,
} from "@prisma/client";

import { db } from "@/lib/db";
import {
  NotificationService,
  type NotificationDispatchInput,
  type NotificationDispatchRecipient,
  type NotificationDispatchResult,
} from "@/server/services/notification-service";

export const APPOINTMENT_REMINDER_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;
export const COURSE_ACCESS_REMINDER_LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000;

export type AppointmentReminderCandidate = {
  id: string;
  staffId: string;
  status: AppointmentStatus;
  customerId: string | null;
  customerEmail: string | null;
  startAt: Date;
  service: {
    name: string;
  };
  payments: Array<{
    payerEmail: string | null;
  }>;
};

export type CourseAccessReminderCandidate = {
  id: string;
  userId: string;
  courseId: string;
  accessUntil: Date | null;
  course: {
    title: string;
  };
};

type AppointmentReminderMilestone = {
  id: "24h" | "2h";
  eventKey: "appointment.reminder_24h" | "appointment.reminder_2h";
  leadMs: number;
  title: string;
  message: (serviceName: string) => string;
};

type CourseAccessReminderMilestone = {
  id: "7d" | "24h" | "expired";
  eventKey: "course.access_expiring" | "course.access_expired";
  leadMs: number;
  title: string;
  message: (courseTitle: string) => string;
  actionUrl: (courseId: string) => string;
};

const appointmentReminderMilestones: AppointmentReminderMilestone[] = [
  {
    id: "24h",
    eventKey: "appointment.reminder_24h",
    leadMs: 24 * 60 * 60 * 1000,
    title: "Recordatorio de cita: 24 horas",
    message: (serviceName) => `Tu cita de ${serviceName} es dentro de aproximadamente 24 horas.`,
  },
  {
    id: "2h",
    eventKey: "appointment.reminder_2h",
    leadMs: 2 * 60 * 60 * 1000,
    title: "Recordatorio de cita: 2 horas",
    message: (serviceName) => `Tu cita de ${serviceName} es dentro de aproximadamente 2 horas.`,
  },
];

const courseAccessReminderMilestones: CourseAccessReminderMilestone[] = [
  {
    id: "7d",
    eventKey: "course.access_expiring",
    leadMs: 7 * 24 * 60 * 60 * 1000,
    title: "Tu acceso vence en 7 d\u00edas",
    message: (courseTitle) => `Tu acceso a ${courseTitle} vence dentro de 7 d\u00edas.`,
    actionUrl: (courseId) => `/learn/${courseId}`,
  },
  {
    id: "24h",
    eventKey: "course.access_expiring",
    leadMs: 24 * 60 * 60 * 1000,
    title: "Tu acceso vence en 24 horas",
    message: (courseTitle) => `Tu acceso a ${courseTitle} vence dentro de aproximadamente 24 horas.`,
    actionUrl: (courseId) => `/learn/${courseId}`,
  },
  {
    id: "expired",
    eventKey: "course.access_expired",
    leadMs: 0,
    title: "Tu acceso al curso ha vencido",
    message: (courseTitle) => `Tu acceso a ${courseTitle} ha vencido.`,
    actionUrl: (courseId) => `/courses/${courseId}`,
  },
];

export type NotificationReminderScheduleResult = {
  scheduled: number;
  errors: string[];
};

export type NotificationReminderSchedulerDeps = {
  now: () => Date;
  findFutureConfirmedAppointments: (
    now: Date,
    horizon: Date,
  ) => Promise<AppointmentReminderCandidate[]>;
  findActiveTimedCourseAccesses: (
    now: Date,
    horizon: Date,
  ) => Promise<CourseAccessReminderCandidate[]>;
  dispatch: (input: NotificationDispatchInput) => Promise<NotificationDispatchResult>;
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown notification scheduling error";
}

function milestoneAt(reference: Date, leadMs: number) {
  return new Date(reference.getTime() - leadMs);
}

/**
 * A scheduling run only creates work for milestones that are still current.
 * If a cron outage or a late rollout discovers an appointment/access after a
 * milestone, it deliberately skips that milestone instead of sending a burst
 * of stale reminders.
 */
function isUnmissedMilestone(scheduledFor: Date, now: Date) {
  return scheduledFor.getTime() >= now.getTime();
}

function appointmentDedupeKey(
  appointment: AppointmentReminderCandidate,
  milestone: AppointmentReminderMilestone,
) {
  return `appointment:${appointment.id}:start:${appointment.startAt.toISOString()}:reminder:${milestone.id}`;
}

function appointmentReminderInput(
  appointment: AppointmentReminderCandidate,
  milestone: AppointmentReminderMilestone,
  scheduledFor: Date,
  recipient: NotificationDispatchRecipient,
  channels: NotificationDeliveryChannel[],
  title: string,
  message: string,
  actionUrl?: string,
): NotificationDispatchInput {
  return {
    eventKey: milestone.eventKey,
    type: "APPOINTMENT",
    title,
    message,
    recipients: [recipient],
    channels,
    resource: { type: "APPOINTMENT", id: appointment.id },
    relatedId: appointment.id,
    actionUrl,
    priority: NotificationPriority.NORMAL,
    dedupeKey: appointmentDedupeKey(appointment, milestone),
    scheduledFor,
  };
}

function staffAppointmentReminderInput(
  appointment: AppointmentReminderCandidate,
  milestone: AppointmentReminderMilestone,
  scheduledFor: Date,
) {
  return appointmentReminderInput(
    appointment,
    milestone,
    scheduledFor,
    { userId: appointment.staffId },
    [NotificationDeliveryChannel.IN_APP],
    milestone.title,
    milestone.message(appointment.service.name),
    "/staff/appointments",
  );
}

function customerAppointmentReminderInput(
  appointment: AppointmentReminderCandidate,
  milestone: AppointmentReminderMilestone,
  scheduledFor: Date,
): NotificationDispatchInput | undefined {
  if (appointment.customerId) {
    return appointmentReminderInput(
      appointment,
      milestone,
      scheduledFor,
      { userId: appointment.customerId },
      [NotificationDeliveryChannel.IN_APP, NotificationDeliveryChannel.EMAIL],
      milestone.title,
      `Recuerda que tu cita de ${appointment.service.name} ${milestone.id === "24h" ? "es ma\u00f1ana" : "es dentro de aproximadamente 2 horas"}.`,
      "/notifications",
    );
  }

  const guestEmail = appointment.customerEmail?.trim() || appointment.payments[0]?.payerEmail?.trim();
  if (!guestEmail) {
    return undefined;
  }

  return appointmentReminderInput(
    appointment,
    milestone,
    scheduledFor,
    { email: guestEmail },
    [NotificationDeliveryChannel.EMAIL],
    milestone.title,
    `Recuerda que tu cita de ${appointment.service.name} ${milestone.id === "24h" ? "es ma\u00f1ana" : "es dentro de aproximadamente 2 horas"}.`,
  );
}

function courseAccessDispatchInput(
  access: CourseAccessReminderCandidate,
  milestone: CourseAccessReminderMilestone,
  scheduledFor: Date,
): NotificationDispatchInput {
  const accessUntil = access.accessUntil!;

  return {
    eventKey: milestone.eventKey,
    type: "PAYMENT",
    title: milestone.title,
    message: milestone.message(access.course.title),
    recipients: [{ userId: access.userId }],
    channels: [NotificationDeliveryChannel.IN_APP],
    resource: { type: "COURSE_ACCESS", id: access.id },
    relatedId: access.courseId,
    actionUrl: milestone.actionUrl(access.courseId),
    priority: NotificationPriority.NORMAL,
    dedupeKey: `course-access:${access.id}:until:${accessUntil.toISOString()}:${milestone.id}`,
    scheduledFor,
  };
}

const defaultDeps: NotificationReminderSchedulerDeps = {
  now: () => new Date(),
  findFutureConfirmedAppointments: async (now, horizon) =>
    db.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        startAt: {
          gte: now,
          lte: horizon,
        },
      },
      select: {
        id: true,
        staffId: true,
        status: true,
        customerId: true,
        customerEmail: true,
        startAt: true,
        service: {
          select: { name: true },
        },
        payments: {
          where: { payerEmail: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { payerEmail: true },
        },
      },
    }),
  findActiveTimedCourseAccesses: async (now, horizon) =>
    db.courseAccess.findMany({
      where: {
        revokedAt: null,
        accessUntil: {
          gt: now,
          lte: horizon,
        },
      },
      select: {
        id: true,
        userId: true,
        courseId: true,
        accessUntil: true,
        course: {
          select: { title: true },
        },
      },
    }),
  dispatch: NotificationService.dispatch,
};

async function dispatchPlannedReminder(
  input: NotificationDispatchInput,
  deps: NotificationReminderSchedulerDeps,
  errors: string[],
) {
  try {
    const result = await deps.dispatch(input);
    if (!result.ok) {
      errors.push(`Failed to schedule notification ${input.eventKey} for ${input.dedupeKey}`);
      return 0;
    }

    return result.deliveries;
  } catch (error) {
    errors.push(
      `Failed to schedule notification ${input.eventKey} for ${input.dedupeKey}: ${toErrorMessage(error)}`,
    );
    return 0;
  }
}

/**
 * Plans only the active reminder window: appointments enter at 24h and timed
 * course access enters at 7d. The outbox owns delivery at the exact future
 * milestone, while an already-due milestone retains the immediate in-app
 * dispatch semantics from NotificationService.dispatch.
 */
export async function scheduleNotificationReminders(
  overrides: Partial<NotificationReminderSchedulerDeps> = {},
): Promise<NotificationReminderScheduleResult> {
  const deps: NotificationReminderSchedulerDeps = { ...defaultDeps, ...overrides };
  const now = deps.now();
  const appointmentHorizon = new Date(now.getTime() + APPOINTMENT_REMINDER_LOOKAHEAD_MS);
  const accessHorizon = new Date(now.getTime() + COURSE_ACCESS_REMINDER_LOOKAHEAD_MS);
  const errors: string[] = [];
  let scheduled = 0;

  const [appointmentsResult, courseAccessesResult] = await Promise.allSettled([
    deps.findFutureConfirmedAppointments(now, appointmentHorizon),
    deps.findActiveTimedCourseAccesses(now, accessHorizon),
  ]);

  if (appointmentsResult.status === "rejected") {
    errors.push(`Failed to query appointment reminders: ${toErrorMessage(appointmentsResult.reason)}`);
  } else {
    for (const appointment of appointmentsResult.value) {
      // Defensive guard in addition to the query: PENDING AUTHORIZE requests
      // get their operational notice, but never appointment reminders.
      if (appointment.status !== AppointmentStatus.CONFIRMED) {
        continue;
      }

      for (const milestone of appointmentReminderMilestones) {
        const scheduledFor = milestoneAt(appointment.startAt, milestone.leadMs);
        if (!isUnmissedMilestone(scheduledFor, now)) {
          continue;
        }

        scheduled += await dispatchPlannedReminder(
          staffAppointmentReminderInput(appointment, milestone, scheduledFor),
          deps,
          errors,
        );

        const customerInput = customerAppointmentReminderInput(
          appointment,
          milestone,
          scheduledFor,
        );
        if (customerInput) {
          scheduled += await dispatchPlannedReminder(customerInput, deps, errors);
        }
      }
    }
  }

  if (courseAccessesResult.status === "rejected") {
    errors.push(`Failed to query course access reminders: ${toErrorMessage(courseAccessesResult.reason)}`);
  } else {
    for (const access of courseAccessesResult.value) {
      if (!access.accessUntil) {
        continue;
      }

      for (const milestone of courseAccessReminderMilestones) {
        const scheduledFor = milestoneAt(access.accessUntil, milestone.leadMs);
        if (!isUnmissedMilestone(scheduledFor, now)) {
          continue;
        }

        scheduled += await dispatchPlannedReminder(
          courseAccessDispatchInput(access, milestone, scheduledFor),
          deps,
          errors,
        );
      }
    }
  }

  return { scheduled, errors };
}
