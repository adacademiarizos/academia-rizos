import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  NotificationDeliveryChannel,
  NotificationPreferenceCategory,
} from "@prisma/client";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    notificationPreference: {
      findMany: vi.fn(),
    },
    notification: {
      upsert: vi.fn(),
    },
    notificationDelivery: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { dispatchNotification } from "@/server/services/notification-dispatcher";

const findPreferencesMock = db.notificationPreference.findMany as Mock;
const notificationUpsertMock = db.notification.upsert as Mock;
const deliveryUpsertMock = db.notificationDelivery.upsert as Mock;
const transactionMock = db.$transaction as Mock;

function communityDispatchInput(
  preferenceCategory: NotificationPreferenceCategory | undefined = NotificationPreferenceCategory.COMMUNITY,
) {
  return {
    eventKey: "community.reply" as const,
    type: "COMMENT",
    title: "Nueva respuesta",
    message: "Respondieron a tu comentario.",
    recipients: [{ userId: "muted-user" }],
    resource: { type: "COURSE_COMMENT", id: "comment-1" },
    actionUrl: "/courses/course-1#comment-comment-1",
    dedupeKey: "comment-1:reply:user-2",
    ...(preferenceCategory ? { preferenceCategory } : {}),
  };
}

describe("dispatchNotification preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findPreferencesMock.mockResolvedValue([]);
    notificationUpsertMock.mockResolvedValue({ id: "notification-1" });
    deliveryUpsertMock.mockResolvedValue({ id: "delivery-1" });
    transactionMock.mockImplementation(async (callback) => callback(db));
  });

  it.each([
    NotificationPreferenceCategory.COMMUNITY,
    NotificationPreferenceCategory.COURSE_UPDATES,
  ])(
    "omits a user who disabled %s without creating a notification or delivery",
    async (category) => {
      findPreferencesMock.mockResolvedValue([{ userId: "muted-user" }]);

      await expect(
        dispatchNotification(communityDispatchInput(category)),
      ).resolves.toEqual({ ok: true, notifications: 0, deliveries: 0 });

      expect(findPreferencesMock).toHaveBeenCalledWith({
        where: {
          category,
          enabled: false,
          userId: { in: ["muted-user"] },
        },
        select: { userId: true },
      });
      expect(notificationUpsertMock).not.toHaveBeenCalled();
      expect(deliveryUpsertMock).not.toHaveBeenCalled();
    },
  );

  it("treats a missing preference as enabled", async () => {
    await expect(dispatchNotification(communityDispatchInput())).resolves.toEqual({
      ok: true,
      notifications: 1,
      deliveries: 1,
    });

    expect(notificationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_dedupeKey: {
            userId: "muted-user",
            dedupeKey: "comment-1:reply:user-2:user:muted-user",
          },
        },
      }),
    );
    expect(deliveryUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          channel: NotificationDeliveryChannel.IN_APP,
          recipientUserId: "muted-user",
        }),
      }),
    );
  });

  it("does not apply an opt-out to transactional events without a preference category", async () => {
    findPreferencesMock.mockResolvedValue([{ userId: "muted-user" }]);
    const { preferenceCategory, ...transactionalBase } = communityDispatchInput();
    expect(preferenceCategory).toBe(NotificationPreferenceCategory.COMMUNITY);

    await expect(
      dispatchNotification({
        ...transactionalBase,
        eventKey: "appointment.paid",
        type: "APPOINTMENT",
        title: "Pago confirmado",
        message: "Tu cita fue pagada.",
        resource: { type: "APPOINTMENT", id: "appointment-1" },
        actionUrl: "/booking",
        dedupeKey: "payment-1:appointment-paid",
      }),
    ).resolves.toEqual({ ok: true, notifications: 1, deliveries: 1 });

    expect(findPreferencesMock).not.toHaveBeenCalled();
    expect(notificationUpsertMock).toHaveBeenCalledTimes(1);
    expect(deliveryUpsertMock).toHaveBeenCalledTimes(1);
  });
});
