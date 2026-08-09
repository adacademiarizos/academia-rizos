import {
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
  NotificationPriority,
} from "@prisma/client";

import { db } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/mail";
import { NotificationService } from "@/server/services/notification-service";

import type { MaintenanceJobResult } from "./types";

export const NOTIFICATION_DELIVERY_BATCH_SIZE = 50;
export const NOTIFICATION_DELIVERY_LEASE_MS = 10 * 60 * 1000;
export const NOTIFICATION_DELIVERY_RETRY_DELAYS_MS = [
  15 * 60 * 1000,
  60 * 60 * 1000,
  4 * 60 * 60 * 1000,
] as const;
/** Initial send plus three delayed retries. */
export const MAX_NOTIFICATION_DELIVERY_ATTEMPTS =
  NOTIFICATION_DELIVERY_RETRY_DELAYS_MS.length + 1;

export type NotificationDeliveryCandidate = {
  id: string;
  notificationId: string | null;
  recipientUserId: string | null;
  eventKey: string;
  dedupeKey: string;
  channel: NotificationDeliveryChannel;
  recipientEmail: string | null;
  type: string;
  relatedId: string | null;
  title: string;
  message: string;
  resourceType: string | null;
  resourceId: string | null;
  actionUrl: string | null;
  priority: NotificationPriority;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  lockedAt: Date | null;
  scheduledFor: Date;
};

export type NotificationDeliveryJobDeps = {
  now: () => Date;
  findDue: (now: Date, staleBefore: Date) => Promise<NotificationDeliveryCandidate[]>;
  claim: (
    delivery: NotificationDeliveryCandidate,
    now: Date,
    staleBefore: Date,
  ) => Promise<boolean>;
  sendEmail: (delivery: NotificationDeliveryCandidate) => Promise<void>;
  materializeInApp: (delivery: NotificationDeliveryCandidate, now: Date) => Promise<void>;
  markSent: (deliveryId: string, now: Date) => Promise<void>;
  requeue: (deliveryId: string, nextAttemptAt: Date, error: string) => Promise<void>;
  markFailed: (deliveryId: string, now: Date, error: string) => Promise<void>;
  notifyDeliveryExhausted: (delivery: NotificationDeliveryCandidate) => Promise<void>;
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown notification delivery error";
}

function buildStaleBefore(now: Date) {
  return new Date(now.getTime() - NOTIFICATION_DELIVERY_LEASE_MS);
}

export function nextNotificationDeliveryAttemptAt(attemptCount: number, now: Date) {
  const delay = NOTIFICATION_DELIVERY_RETRY_DELAYS_MS[attemptCount - 1];
  if (!delay) {
    throw new Error("No retry delay configured for attempt " + attemptCount);
  }

  return new Date(now.getTime() + delay);
}

const defaultDeps: NotificationDeliveryJobDeps = {
  now: () => new Date(),
  findDue: async (now, staleBefore) =>
    db.notificationDelivery.findMany({
      where: {
        OR: [
          {
            status: NotificationDeliveryStatus.PENDING,
            scheduledFor: { lte: now },
          },
          {
            status: NotificationDeliveryStatus.PROCESSING,
            lockedAt: { lte: staleBefore },
          },
        ],
      },
      orderBy: { scheduledFor: "asc" },
      take: NOTIFICATION_DELIVERY_BATCH_SIZE,
      select: {
        id: true,
        notificationId: true,
        recipientUserId: true,
        eventKey: true,
        dedupeKey: true,
        channel: true,
        recipientEmail: true,
        type: true,
        relatedId: true,
        title: true,
        message: true,
        resourceType: true,
        resourceId: true,
        actionUrl: true,
        priority: true,
        status: true,
        attemptCount: true,
        lockedAt: true,
        scheduledFor: true,
      },
    }),
  claim: async (delivery, now, staleBefore) => {
    const where =
      delivery.status === NotificationDeliveryStatus.PENDING
        ? {
            id: delivery.id,
            status: NotificationDeliveryStatus.PENDING,
            scheduledFor: { lte: now },
          }
        : {
            id: delivery.id,
            status: NotificationDeliveryStatus.PROCESSING,
            lockedAt: { lte: staleBefore },
          };

    const result = await db.notificationDelivery.updateMany({
      where,
      data: {
        status: NotificationDeliveryStatus.PROCESSING,
        lockedAt: now,
        attemptCount: { increment: 1 },
      },
    });

    return result.count === 1;
  },
  sendEmail: async (delivery) => {
    if (!delivery.recipientEmail) {
      throw new Error("EMAIL notification delivery is missing recipientEmail");
    }

    await sendNotificationEmail({
      to: delivery.recipientEmail,
      title: delivery.title,
      message: delivery.message,
      actionUrl: delivery.actionUrl,
    });
  },
  materializeInApp: async (delivery, now) => {
    await NotificationService.materializeInAppDelivery({
      id: delivery.id,
      recipientUserId: delivery.recipientUserId,
      eventKey: delivery.eventKey,
      dedupeKey: delivery.dedupeKey,
      type: delivery.type,
      relatedId: delivery.relatedId,
      title: delivery.title,
      message: delivery.message,
      resourceType: delivery.resourceType,
      resourceId: delivery.resourceId,
      actionUrl: delivery.actionUrl,
      priority: delivery.priority,
    }, now);
  },
  markSent: async (deliveryId, now) => {
    await db.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.SENT,
        sentAt: now,
        lockedAt: null,
        failedAt: null,
        lastError: null,
      },
    });
  },
  requeue: async (deliveryId, nextAttemptAt, error) => {
    await db.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.PENDING,
        scheduledFor: nextAttemptAt,
        lockedAt: null,
        lastError: error,
      },
    });
  },
  markFailed: async (deliveryId, now, error) => {
    await db.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.FAILED,
        failedAt: now,
        lockedAt: null,
        lastError: error,
      },
    });
  },
  notifyDeliveryExhausted: async (delivery) => {
    await NotificationService.notifyDeliveryExhausted({
      deliveryId: delivery.id,
      eventKey: delivery.eventKey,
      resource:
        delivery.resourceType && delivery.resourceId
          ? { type: delivery.resourceType, id: delivery.resourceId }
          : undefined,
    });
  },
};

/**
 * Claims due rows with a conditional update before delivering them. The claim
 * makes concurrent cron invocations safe: only the caller that changes one
 * row to PROCESSING can send it. A stale lease is reclaimable after 10 minutes.
 */
export async function processNotificationDeliveries(
  overrides: Partial<NotificationDeliveryJobDeps> = {},
): Promise<MaintenanceJobResult> {
  const deps: NotificationDeliveryJobDeps = { ...defaultDeps, ...overrides };
  let processed = 0;
  const errors: string[] = [];

  try {
    const now = deps.now();
    const staleBefore = buildStaleBefore(now);
    const dueDeliveries = await deps.findDue(now, staleBefore);

    for (const delivery of dueDeliveries) {
      let claimed = false;
      try {
        claimed = await deps.claim(delivery, now, staleBefore);
      } catch (error) {
        errors.push("Failed to claim notification delivery " + delivery.id + ": " + toErrorMessage(error));
        continue;
      }

      if (!claimed) {
        continue;
      }

      const attemptCount = delivery.attemptCount + 1;

      try {
        if (delivery.channel === NotificationDeliveryChannel.IN_APP) {
          await deps.materializeInApp(delivery, now);
        } else {
          await deps.sendEmail(delivery);
          await deps.markSent(delivery.id, now);
        }
        processed += 1;
      } catch (error) {
        const message = toErrorMessage(error);

        try {
          if (attemptCount >= MAX_NOTIFICATION_DELIVERY_ATTEMPTS) {
            await deps.markFailed(delivery.id, now, message);
            await deps.notifyDeliveryExhausted(delivery);
            errors.push("Notification delivery " + delivery.id + " exhausted retries: " + message);
          } else {
            await deps.requeue(
              delivery.id,
              nextNotificationDeliveryAttemptAt(attemptCount, now),
              message,
            );
            console.warn("[notifications] delivery " + delivery.id + " failed and was scheduled for retry", error);
          }
        } catch (persistenceError) {
          errors.push(
            "Failed to persist retry state for notification delivery " +
              delivery.id +
              ": " +
              toErrorMessage(persistenceError),
          );
        }
      }
    }
  } catch (error) {
    errors.push("Notification delivery job failed: " + toErrorMessage(error));
  }

  return { processed, errors };
}

export async function notificationDeliveryJob(): Promise<MaintenanceJobResult> {
  return processNotificationDeliveries();
}
