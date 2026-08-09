import { describe, expect, it, jest } from "@jest/globals";
import {
  AppointmentStatus,
  NotificationDeliveryChannel,
} from "@prisma/client";

const db = {
  appointment: {
    findMany: jest.fn(),
  },
  courseAccess: {
    findMany: jest.fn(),
  },
};

jest.mock("@/lib/db", () => ({ db }));
jest.mock("@/lib/mail", () => ({
  sendNotificationEmail: jest.fn(),
}));

import {
  APPOINTMENT_REMINDER_LOOKAHEAD_MS,
  COURSE_ACCESS_REMINDER_LOOKAHEAD_MS,
  type AppointmentReminderCandidate,
  type CourseAccessReminderCandidate,
  type NotificationReminderSchedulerDeps,
  scheduleNotificationReminders,
} from "@/server/jobs/notification-schedule.job";
import {
  notificationDeliveryJob,
  type NotificationJobDeps,
} from "@/server/jobs/notification-delivery.job";

const NOW = new Date("2026-08-09T12:00:00.000Z");

function addMs(value: Date, milliseconds: number) {
  return new Date(value.getTime() + milliseconds);
}

function makeAppointment(
  overrides: Partial<AppointmentReminderCandidate> = {},
): AppointmentReminderCandidate {
  return {
    id: "appointment-1",
    staffId: "staff-1",
    status: AppointmentStatus.CONFIRMED,
    customerId: "customer-1",
    customerEmail: "customer@example.com",
    startAt: addMs(NOW, 24 * 60 * 60 * 1000),
    service: { name: "Corte" },
    payments: [{ payerEmail: "payer@example.com" }],
    ...overrides,
  };
}

function makeCourseAccess(
  overrides: Partial<CourseAccessReminderCandidate> = {},
): CourseAccessReminderCandidate {
  return {
    id: "access-1",
    userId: "student-1",
    courseId: "course-1",
    accessUntil: addMs(NOW, 7 * 24 * 60 * 60 * 1000),
    course: { title: "Rizos definidos" },
    ...overrides,
  };
}

function createDeps(
  appointments: AppointmentReminderCandidate[] = [],
  courseAccesses: CourseAccessReminderCandidate[] = [],
  overrides: Partial<NotificationReminderSchedulerDeps> = {},
): NotificationReminderSchedulerDeps {
  return {
    now: () => NOW,
    findFutureConfirmedAppointments: jest.fn().mockResolvedValue(appointments),
    findActiveTimedCourseAccesses: jest.fn().mockResolvedValue(courseAccesses),
    dispatch: jest.fn().mockResolvedValue({
      ok: true,
      notifications: 0,
      deliveries: 1,
    }),
    ...overrides,
  };
}

describe("scheduleNotificationReminders", () => {
  it("queries only confirmed appointments and active timed access in their planning horizons", async () => {
    db.appointment.findMany.mockResolvedValue([]);
    db.courseAccess.findMany.mockResolvedValue([]);

    await scheduleNotificationReminders({ now: () => NOW });

    expect(db.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: AppointmentStatus.CONFIRMED,
          startAt: {
            gte: NOW,
            lte: addMs(NOW, APPOINTMENT_REMINDER_LOOKAHEAD_MS),
          },
        }),
      }),
    );
    expect(db.courseAccess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          revokedAt: null,
          accessUntil: {
            gt: NOW,
            lte: addMs(NOW, COURSE_ACCESS_REMINDER_LOOKAHEAD_MS),
          },
        }),
      }),
    );
  });

  it("plans 24h and 2h reminders for STAFF in-app and an account customer in-app plus email", async () => {
    const appointment = makeAppointment();
    const deps = createDeps([appointment]);

    const result = await scheduleNotificationReminders(deps);
    const inputs = (deps.dispatch as jest.Mock).mock.calls.map(([input]) => input);

    expect(result).toEqual({ scheduled: 4, errors: [] });
    expect(inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventKey: "appointment.reminder_24h",
          recipients: [{ userId: "staff-1" }],
          channels: [NotificationDeliveryChannel.IN_APP],
          actionUrl: "/staff/appointments",
          scheduledFor: NOW,
          dedupeKey: "appointment:appointment-1:start:2026-08-10T12:00:00.000Z:reminder:24h",
        }),
        expect.objectContaining({
          eventKey: "appointment.reminder_24h",
          recipients: [{ userId: "customer-1" }],
          channels: [
            NotificationDeliveryChannel.IN_APP,
            NotificationDeliveryChannel.EMAIL,
          ],
          actionUrl: "/notifications",
          scheduledFor: NOW,
          dedupeKey: "appointment:appointment-1:start:2026-08-10T12:00:00.000Z:reminder:24h",
        }),
        expect.objectContaining({
          eventKey: "appointment.reminder_2h",
          recipients: [{ userId: "staff-1" }],
          scheduledFor: new Date("2026-08-10T10:00:00.000Z"),
        }),
        expect.objectContaining({
          eventKey: "appointment.reminder_2h",
          recipients: [{ userId: "customer-1" }],
          scheduledFor: new Date("2026-08-10T10:00:00.000Z"),
        }),
      ]),
    );
  });

  it("uses the guest email fallback and skips appointment milestones already missed", async () => {
    const appointment = makeAppointment({
      customerId: null,
      customerEmail: null,
      payments: [{ payerEmail: "guest@example.com" }],
      startAt: addMs(NOW, 3 * 60 * 60 * 1000),
    });
    const deps = createDeps([appointment]);

    const result = await scheduleNotificationReminders(deps);
    const inputs = (deps.dispatch as jest.Mock).mock.calls.map(([input]) => input);

    expect(result).toEqual({ scheduled: 2, errors: [] });
    expect(inputs).toHaveLength(2);
    expect(inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventKey: "appointment.reminder_2h",
          recipients: [{ userId: "staff-1" }],
          channels: [NotificationDeliveryChannel.IN_APP],
        }),
        expect.objectContaining({
          eventKey: "appointment.reminder_2h",
          recipients: [{ email: "guest@example.com" }],
          channels: [NotificationDeliveryChannel.EMAIL],
          actionUrl: undefined,
        }),
      ]),
    );
    expect(inputs.some((input) => input.eventKey === "appointment.reminder_24h")).toBe(false);
  });

  it("plans course-access 7d, 24h, and expiry milestones with a safe action URL", async () => {
    const deps = createDeps([], [makeCourseAccess()]);

    const result = await scheduleNotificationReminders(deps);
    const inputs = (deps.dispatch as jest.Mock).mock.calls.map(([input]) => input);

    expect(result).toEqual({ scheduled: 3, errors: [] });
    expect(inputs).toEqual([
      expect.objectContaining({
        eventKey: "course.access_expiring",
        recipients: [{ userId: "student-1" }],
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: "COURSE_ACCESS", id: "access-1" },
        actionUrl: "/learn/course-1",
        scheduledFor: NOW,
        dedupeKey: "course-access:access-1:until:2026-08-16T12:00:00.000Z:7d",
      }),
      expect.objectContaining({
        eventKey: "course.access_expiring",
        actionUrl: "/learn/course-1",
        scheduledFor: new Date("2026-08-15T12:00:00.000Z"),
        dedupeKey: "course-access:access-1:until:2026-08-16T12:00:00.000Z:24h",
      }),
      expect.objectContaining({
        eventKey: "course.access_expired",
        actionUrl: "/courses/course-1",
        scheduledFor: new Date("2026-08-16T12:00:00.000Z"),
        dedupeKey: "course-access:access-1:until:2026-08-16T12:00:00.000Z:expired",
      }),
    ]);
  });

  it("does not backfill missed milestones after a late scheduler run", async () => {
    const lateAppointment = makeAppointment({
      startAt: addMs(NOW, 60 * 60 * 1000),
    });
    const accessNearExpiry = makeCourseAccess({
      accessUntil: addMs(NOW, 23 * 60 * 60 * 1000),
    });
    const deps = createDeps([lateAppointment], [accessNearExpiry]);

    const result = await scheduleNotificationReminders(deps);
    const inputs = (deps.dispatch as jest.Mock).mock.calls.map(([input]) => input);

    expect(result).toEqual({ scheduled: 1, errors: [] });
    expect(inputs).toEqual([
      expect.objectContaining({
        eventKey: "course.access_expired",
        scheduledFor: new Date("2026-08-10T11:00:00.000Z"),
      }),
    ]);
  });

  it("does not plan reminders for a PENDING AUTHORIZE-style appointment", async () => {
    const deps = createDeps([
      makeAppointment({ status: AppointmentStatus.PENDING }),
    ]);

    await expect(scheduleNotificationReminders(deps)).resolves.toEqual({
      scheduled: 0,
      errors: [],
    });
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("continues planning access reminders when the appointment query fails", async () => {
    const deps = createDeps([], [makeCourseAccess()], {
      findFutureConfirmedAppointments: jest.fn().mockRejectedValue(new Error("appointment query timeout")),
    });

    const result = await scheduleNotificationReminders(deps);

    expect(result.scheduled).toBe(3);
    expect(result.errors).toEqual(["Failed to query appointment reminders: appointment query timeout"]);
  });
});

describe("notificationDeliveryJob", () => {
  it("runs the outbox worker even when reminder scheduling fails", async () => {
    const calls: string[] = [];
    const deps: NotificationJobDeps = {
      scheduleReminders: async () => {
        calls.push("schedule");
        throw new Error("schedule unavailable");
      },
      processDeliveries: async () => {
        calls.push("deliver");
        return { processed: 2, errors: [] };
      },
    };

    await expect(notificationDeliveryJob(deps)).resolves.toEqual({
      processed: 2,
      errors: ["Notification reminder scheduling failed: schedule unavailable"],
    });
    expect(calls).toEqual(["schedule", "deliver"]);
  });
});
