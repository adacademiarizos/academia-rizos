import { createHash } from "node:crypto";

import {
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
  NotificationPreferenceCategory,
  NotificationPriority,
  type Prisma,
} from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Domain events currently supported by the notification infrastructure.
 * `type` remains a separate, legacy presentation category so older consumers
 * can keep rendering their existing icons while producers migrate gradually.
 */
export const notificationEventKeys = [
  "appointment.requested",
  "appointment.paid",
  "appointment.status_changed",
  "appointment.reminder_24h",
  "appointment.reminder_2h",
  "payment_link.paid",
  "payment_link.expired",
  "payment_link.failed",
  "payment_link.refunded",
  "payment.receipt",
  "payment.failed",
  "payment.refunded",
  "payment.dispute_created",
  "payment.dispute_closed",
  "course.access_granted",
  "course.access_revoked",
  "course.access_expiring",
  "course.access_expired",
  "course.published",
  "achievement.earned",
  "academy.submission.received",
  "academy.submission.pending_review",
  "academy.review.completed",
  "academy.course.completed",
  "certificate.pending",
  "certificate.issued",
  "certificate.revoked",
  "user.registered",
  "user.role_changed",
  "bug_report.created",
  "bug_report.acknowledged",
  "community.mention",
  "community.reply",
  "chat.mention",
  "notification.delivery_exhausted",
] as const;

export type NotificationEventKey = (typeof notificationEventKeys)[number];

export type NotificationResource = {
  type: string;
  id: string;
};

export type NotificationDispatchRecipient = {
  /** Required when requesting an IN_APP delivery. */
  userId?: string;
  /** Required when requesting an EMAIL delivery unless userId resolves to an email. */
  email?: string;
  /** Defaults to input.channels, then IN_APP for users or EMAIL for guests. */
  channels?: NotificationDeliveryChannel[];
};

export type NotificationDispatchInput = {
  eventKey: NotificationEventKey;
  /** Existing notification category, retained for legacy clients. */
  type: string;
  title: string;
  message: string;
  recipients: NotificationDispatchRecipient[];
  resource?: NotificationResource;
  actionUrl?: string;
  relatedId?: string;
  priority?: NotificationPriority;
  /** Stable identity for one domain-event occurrence, before recipient scoping. */
  dedupeKey: string;
  channels?: NotificationDeliveryChannel[];
  /** Future values create pending outbox rows instead of visible in-app items. */
  scheduledFor?: Date;
  /**
   * Opt-in category for discretionary events only. Transactional, security and
   * academic-review events deliberately omit this field and cannot be muted.
   */
  preferenceCategory?: NotificationPreferenceCategory;
};

export type NotificationDispatchResult =
  | {
      ok: true;
      notifications: number;
      deliveries: number;
    }
  | {
      ok: false;
      notifications: 0;
      deliveries: 0;
      error: "NOTIFICATION_DISPATCH_FAILED";
    };

export type CancelScheduledDeliveriesInput = {
  resource: NotificationResource;
  eventKey?: NotificationEventKey;
  /** Exact, recipient-scoped delivery dedupe key when provided. */
  dedupeKey?: string;
};

export type CancelScheduledDeliveriesResult =
  | { ok: true; count: number }
  | { ok: false; count: 0; error: "NOTIFICATION_DELIVERY_CANCEL_FAILED" };

export type PendingInAppDelivery = {
  id: string;
  recipientUserId: string | null;
  eventKey: string;
  dedupeKey: string;
  type: string;
  relatedId: string | null;
  title: string;
  message: string;
  resourceType: string | null;
  resourceId: string | null;
  actionUrl: string | null;
  priority: NotificationPriority;
};

const eventKeySet = new Set<string>(notificationEventKeys);

function normalizeRequiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("A valid recipient email is required");
  }
  return normalized;
}

function isInternalActionUrl(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

function hashEmail(email: string) {
  return createHash("sha256").update(email).digest("hex");
}

function uniqueChannels(channels: NotificationDeliveryChannel[]) {
  return Array.from(new Set(channels));
}

function resolveChannels(
  recipient: NotificationDispatchRecipient,
  defaultChannels: NotificationDeliveryChannel[] | undefined,
) {
  const channels = recipient.channels ?? defaultChannels;
  if (channels?.length) {
    return uniqueChannels(channels);
  }

  return recipient.userId
    ? [NotificationDeliveryChannel.IN_APP]
    : [NotificationDeliveryChannel.EMAIL];
}

type ResolvedRecipient = {
  userId?: string;
  email?: string;
  channels: NotificationDeliveryChannel[];
};

async function resolveRecipients(input: NotificationDispatchInput) {
  if (input.recipients.length === 0) {
    throw new Error("At least one notification recipient is required");
  }

  const resolved: ResolvedRecipient[] = [];

  for (const recipient of input.recipients) {
    const channels = resolveChannels(recipient, input.channels);
    const userId = recipient.userId?.trim() || undefined;

    if (channels.includes(NotificationDeliveryChannel.IN_APP) && !userId) {
      throw new Error("IN_APP delivery requires a userId");
    }

    let email = recipient.email ? normalizeEmail(recipient.email) : undefined;
    if (channels.includes(NotificationDeliveryChannel.EMAIL) && !email && userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      email = user?.email ? normalizeEmail(user.email) : undefined;
    }

    if (channels.includes(NotificationDeliveryChannel.EMAIL) && !email) {
      throw new Error("EMAIL delivery requires an email or a user with an email");
    }

    resolved.push({ userId, email, channels });
  }

  return resolved;
}

async function applyNotificationPreferences(
  recipients: ResolvedRecipient[],
  category: NotificationPreferenceCategory | undefined,
) {
  if (!category) {
    return recipients;
  }

  const userIds = Array.from(
    new Set(recipients.flatMap((recipient) => (recipient.userId ? [recipient.userId] : []))),
  );

  if (userIds.length === 0) {
    return recipients;
  }

  const disabled = await db.notificationPreference.findMany({
    where: {
      category,
      enabled: false,
      userId: { in: userIds },
    },
    select: { userId: true },
  });
  const disabledUserIds = new Set(disabled.map((preference) => preference.userId));

  return recipients.filter((recipient) => !recipient.userId || !disabledUserIds.has(recipient.userId));
}

function inAppDedupeKey(eventDedupeKey: string, userId: string) {
  return `${eventDedupeKey}:user:${userId}`;
}

function emailDedupeKey(eventDedupeKey: string, email: string) {
  return `${eventDedupeKey}:email:${hashEmail(email)}`;
}

function isScheduledForFuture(scheduledFor: Date, now: Date) {
  return scheduledFor.getTime() > now.getTime();
}

function notificationCreateData(
  input: NotificationDispatchInput,
  dedupeKey: string,
  userId: string,
) {
  return {
    userId,
    type: input.type,
    eventKey: input.eventKey,
    dedupeKey,
    title: input.title,
    message: input.message,
    relatedId: input.relatedId ?? input.resource?.id,
    resourceType: input.resource?.type,
    resourceId: input.resource?.id,
    actionUrl: input.actionUrl,
    priority: input.priority ?? NotificationPriority.NORMAL,
  };
}

function deliveryCreateData(
  input: NotificationDispatchInput,
  options: {
    channel: NotificationDeliveryChannel;
    dedupeKey: string;
    notificationId?: string;
    recipientUserId?: string;
    recipientEmail?: string;
    status: NotificationDeliveryStatus;
    sentAt?: Date;
    scheduledFor: Date;
  },
) {
  return {
    notificationId: options.notificationId,
    recipientUserId: options.recipientUserId,
    eventKey: input.eventKey,
    dedupeKey: options.dedupeKey,
    channel: options.channel,
    recipientEmail: options.recipientEmail,
    type: input.type,
    relatedId: input.relatedId ?? input.resource?.id,
    title: input.title,
    message: input.message,
    resourceType: input.resource?.type,
    resourceId: input.resource?.id,
    actionUrl: input.actionUrl,
    priority: input.priority ?? NotificationPriority.NORMAL,
    scheduledFor: options.scheduledFor,
    status: options.status,
    sentAt: options.sentAt,
  };
}

/**
 * Persists in-app delivery immediately and queues all email work in the same
 * transaction. It intentionally returns an error result instead of throwing so
 * notification infrastructure cannot roll back a business operation.
 */
export async function dispatchNotification(
  input: NotificationDispatchInput,
): Promise<NotificationDispatchResult> {
  try {
    if (!eventKeySet.has(input.eventKey)) {
      throw new Error(`Unsupported notification event key: ${input.eventKey}`);
    }

    normalizeRequiredText(input.type, "Notification type");
    normalizeRequiredText(input.title, "Notification title");
    normalizeRequiredText(input.message, "Notification message");
    const eventDedupeKey = normalizeRequiredText(input.dedupeKey, "Notification dedupe key");

    if (input.resource) {
      normalizeRequiredText(input.resource.type, "Notification resource type");
      normalizeRequiredText(input.resource.id, "Notification resource id");
    }

    if (input.actionUrl && !isInternalActionUrl(input.actionUrl)) {
      throw new Error("Notification actionUrl must be an internal relative URL");
    }

    const recipients = await applyNotificationPreferences(
      await resolveRecipients(input),
      input.preferenceCategory,
    );
    const now = new Date();
    const scheduledFor = input.scheduledFor ?? now;
    const scheduled = isScheduledForFuture(scheduledFor, now);

    const result = await db.$transaction(async (tx) => {
      let notifications = 0;
      let deliveries = 0;
      const seenInApp = new Set<string>();
      const seenEmails = new Set<string>();
      const inAppNotificationsByUserId = new Map<string, string>();

      for (const recipient of recipients) {
        if (
          recipient.userId &&
          recipient.channels.includes(NotificationDeliveryChannel.IN_APP) &&
          !seenInApp.has(recipient.userId)
        ) {
          seenInApp.add(recipient.userId);
          const dedupeKey = inAppDedupeKey(eventDedupeKey, recipient.userId);

          if (scheduled) {
            await tx.notificationDelivery.upsert({
              where: {
                channel_dedupeKey: {
                  channel: NotificationDeliveryChannel.IN_APP,
                  dedupeKey,
                },
              },
              create: deliveryCreateData(input, {
                channel: NotificationDeliveryChannel.IN_APP,
                dedupeKey,
                recipientUserId: recipient.userId,
                status: NotificationDeliveryStatus.PENDING,
                scheduledFor,
              }),
              update: {},
            });
            deliveries += 1;
          } else {
            const notification = await tx.notification.upsert({
              where: {
                userId_dedupeKey: {
                  userId: recipient.userId,
                  dedupeKey,
                },
              },
              create: notificationCreateData(input, dedupeKey, recipient.userId),
              update: {},
            });

            await tx.notificationDelivery.upsert({
              where: {
                channel_dedupeKey: {
                  channel: NotificationDeliveryChannel.IN_APP,
                  dedupeKey,
                },
              },
              create: deliveryCreateData(input, {
                channel: NotificationDeliveryChannel.IN_APP,
                dedupeKey,
                notificationId: notification.id,
                recipientUserId: recipient.userId,
                status: NotificationDeliveryStatus.SENT,
                sentAt: now,
                scheduledFor,
              }),
              update: {},
            });

            inAppNotificationsByUserId.set(recipient.userId, notification.id);
            notifications += 1;
            deliveries += 1;
          }
        }

        if (
          recipient.email &&
          recipient.channels.includes(NotificationDeliveryChannel.EMAIL) &&
          !seenEmails.has(recipient.email)
        ) {
          seenEmails.add(recipient.email);
          const dedupeKey = emailDedupeKey(eventDedupeKey, recipient.email);
          const inAppNotificationId = recipient.userId && !scheduled
            ? inAppNotificationsByUserId.get(recipient.userId)
            : undefined;

          await tx.notificationDelivery.upsert({
            where: {
              channel_dedupeKey: {
                channel: NotificationDeliveryChannel.EMAIL,
                dedupeKey,
              },
            },
            create: deliveryCreateData(input, {
              channel: NotificationDeliveryChannel.EMAIL,
              dedupeKey,
              notificationId: inAppNotificationId,
              recipientUserId: recipient.userId,
              recipientEmail: recipient.email,
              status: NotificationDeliveryStatus.PENDING,
              scheduledFor,
            }),
            update: {},
          });
          deliveries += 1;
        }
      }

      return { notifications, deliveries };
    });

    return { ok: true, ...result };
  } catch (error) {
    console.error("[notifications] dispatch failed", error);
    return {
      ok: false,
      notifications: 0,
      deliveries: 0,
      error: "NOTIFICATION_DISPATCH_FAILED",
    };
  }
}

/**
 * Cancels only explicitly scoped future deliveries. The caller must provide a
 * resource, and may further narrow the operation by exact event or dedupe key.
 */
export async function cancelScheduledNotificationDeliveries(
  input: CancelScheduledDeliveriesInput,
): Promise<CancelScheduledDeliveriesResult> {
  try {
    const resourceType = normalizeRequiredText(input.resource.type, "Notification resource type");
    const resourceId = normalizeRequiredText(input.resource.id, "Notification resource id");

    const result = await db.notificationDelivery.updateMany({
      where: {
        resourceType,
        resourceId,
        status: NotificationDeliveryStatus.PENDING,
        ...(input.eventKey ? { eventKey: input.eventKey } : {}),
        ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
      },
      data: {
        status: NotificationDeliveryStatus.CANCELLED,
      },
    });

    return { ok: true, count: result.count };
  } catch (error) {
    console.error("[notifications] scheduled delivery cancellation failed", error);
    return { ok: false, count: 0, error: "NOTIFICATION_DELIVERY_CANCEL_FAILED" };
  }
}

/**
 * Materializes a due in-app outbox record. It is intentionally throwing: the
 * worker needs the failure in order to schedule a retry or terminal alert.
 */
export async function materializeInAppNotificationDelivery(
  delivery: PendingInAppDelivery,
  now = new Date(),
) {
  if (!delivery.recipientUserId) {
    throw new Error("IN_APP notification delivery is missing recipientUserId");
  }

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const notification = await tx.notification.upsert({
      where: {
        userId_dedupeKey: {
          userId: delivery.recipientUserId!,
          dedupeKey: delivery.dedupeKey,
        },
      },
      create: {
        userId: delivery.recipientUserId!,
        type: delivery.type,
        eventKey: delivery.eventKey,
        dedupeKey: delivery.dedupeKey,
        title: delivery.title,
        message: delivery.message,
        relatedId: delivery.relatedId,
        resourceType: delivery.resourceType,
        resourceId: delivery.resourceId,
        actionUrl: delivery.actionUrl,
        priority: delivery.priority,
      },
      update: {},
    });

    await tx.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        notificationId: notification.id,
        status: NotificationDeliveryStatus.SENT,
        sentAt: now,
        lockedAt: null,
        lastError: null,
      },
    });

    return notification;
  });
}
