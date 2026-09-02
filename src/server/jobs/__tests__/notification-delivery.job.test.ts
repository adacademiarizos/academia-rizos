import { describe, expect, it, vi } from "vitest";
import {
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
  NotificationPriority,
} from "@prisma/client";

vi.mock("@/lib/db", () => ({
  db: {
    notificationDelivery: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/mail", () => ({
  sendNotificationEmail: vi.fn(),
}));
vi.mock("@/server/services/notification-service", () => ({
  NotificationService: {
    materializeInAppDelivery: vi.fn(),
    notifyDeliveryExhausted: vi.fn(),
  },
}));

import {
  MAX_NOTIFICATION_DELIVERY_ATTEMPTS,
  type NotificationDeliveryCandidate,
  type NotificationDeliveryJobDeps,
  nextNotificationDeliveryAttemptAt,
  processNotificationDeliveries,
} from "@/server/jobs/notification-delivery.job";

const NOW = new Date("2026-08-09T12:00:00.000Z");

function makeDelivery(
  overrides: Partial<NotificationDeliveryCandidate> = {},
): NotificationDeliveryCandidate {
  return {
    id: "delivery-1",
    notificationId: null,
    recipientUserId: "user-1",
    eventKey: "appointment.reminder_24h",
    dedupeKey: "appointment-1:reminder:user:user-1",
    channel: NotificationDeliveryChannel.EMAIL,
    recipientEmail: "student@example.com",
    type: "APPOINTMENT",
    relatedId: "appointment-1",
    title: "Recordatorio",
    message: "Tu cita es mañana",
    resourceType: "APPOINTMENT",
    resourceId: "appointment-1",
    actionUrl: "/appointments/appointment-1",
    priority: NotificationPriority.NORMAL,
    status: NotificationDeliveryStatus.PENDING,
    attemptCount: 0,
    lockedAt: null,
    scheduledFor: NOW,
    ...overrides,
  };
}

function createDeps(
  deliveries: NotificationDeliveryCandidate[],
  overrides: Partial<NotificationDeliveryJobDeps> = {},
): NotificationDeliveryJobDeps {
  return {
    now: () => NOW,
    findDue: vi.fn().mockResolvedValue(deliveries),
    claim: vi.fn().mockResolvedValue(true),
    sendEmail: vi.fn().mockResolvedValue(undefined),
    materializeInApp: vi.fn().mockResolvedValue(undefined),
    markSent: vi.fn().mockResolvedValue(undefined),
    requeue: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    notifyDeliveryExhausted: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("processNotificationDeliveries", () => {
  it("claims and sends a due email once", async () => {
    const delivery = makeDelivery();
    const deps = createDeps([delivery]);

    const result = await processNotificationDeliveries(deps);

    expect(result).toEqual({ processed: 1, errors: [] });
    expect(deps.claim).toHaveBeenCalledWith(
      delivery,
      NOW,
      new Date(NOW.getTime() - 10 * 60 * 1000),
    );
    expect(deps.sendEmail).toHaveBeenCalledWith(delivery);
    expect(deps.markSent).toHaveBeenCalledWith(delivery.id, NOW);
  });

  it("does not deliver when another cron invocation already claimed the row", async () => {
    const delivery = makeDelivery();
    const deps = createDeps([delivery], {
      claim: vi.fn().mockResolvedValue(false),
    });

    const result = await processNotificationDeliveries(deps);

    expect(result).toEqual({ processed: 0, errors: [] });
    expect(deps.sendEmail).not.toHaveBeenCalled();
    expect(deps.materializeInApp).not.toHaveBeenCalled();
  });

  it("materializes scheduled IN_APP delivery instead of sending email", async () => {
    const delivery = makeDelivery({
      channel: NotificationDeliveryChannel.IN_APP,
      recipientEmail: null,
    });
    const deps = createDeps([delivery]);

    const result = await processNotificationDeliveries(deps);

    expect(result).toEqual({ processed: 1, errors: [] });
    expect(deps.materializeInApp).toHaveBeenCalledWith(delivery, NOW);
    expect(deps.sendEmail).not.toHaveBeenCalled();
    expect(deps.markSent).not.toHaveBeenCalled();
  });

  it("schedules the first failed attempt with a 15-minute backoff without failing the job", async () => {
    const delivery = makeDelivery();
    const deps = createDeps([delivery], {
      sendEmail: vi.fn().mockRejectedValue(new Error("smtp timeout")),
    });

    const result = await processNotificationDeliveries(deps);

    expect(result).toEqual({ processed: 0, errors: [] });
    expect(deps.requeue).toHaveBeenCalledWith(
      delivery.id,
      new Date(NOW.getTime() + 15 * 60 * 1000),
      "smtp timeout",
    );
    expect(deps.markFailed).not.toHaveBeenCalled();
  });

  it("marks the fourth failed send terminal and alerts admins in-app", async () => {
    const delivery = makeDelivery({
      attemptCount: MAX_NOTIFICATION_DELIVERY_ATTEMPTS - 1,
    });
    const deps = createDeps([delivery], {
      sendEmail: vi.fn().mockRejectedValue(new Error("mailbox unavailable")),
    });

    const result = await processNotificationDeliveries(deps);

    expect(result.processed).toBe(0);
    expect(result.errors).toEqual([
      "Notification delivery delivery-1 exhausted retries: mailbox unavailable",
    ]);
    expect(deps.markFailed).toHaveBeenCalledWith(
      delivery.id,
      NOW,
      "mailbox unavailable",
    );
    expect(deps.notifyDeliveryExhausted).toHaveBeenCalledWith(delivery);
  });

  it("uses the configured retry schedule and rejects attempts beyond it", () => {
    expect(nextNotificationDeliveryAttemptAt(1, NOW)).toEqual(
      new Date(NOW.getTime() + 15 * 60 * 1000),
    );
    expect(nextNotificationDeliveryAttemptAt(2, NOW)).toEqual(
      new Date(NOW.getTime() + 60 * 60 * 1000),
    );
    expect(nextNotificationDeliveryAttemptAt(3, NOW)).toEqual(
      new Date(NOW.getTime() + 4 * 60 * 60 * 1000),
    );
    expect(() => nextNotificationDeliveryAttemptAt(4, NOW)).toThrow(
      "No retry delay configured for attempt 4",
    );
  });
});
