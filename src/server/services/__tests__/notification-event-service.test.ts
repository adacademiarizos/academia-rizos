import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  NotificationDeliveryChannel,
  NotificationPreferenceCategory,
  NotificationPriority,
} from "@prisma/client";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/notification-dispatcher", () => ({
  dispatchNotification: vi.fn(),
  cancelScheduledNotificationDeliveries: vi.fn(),
}));

import { db } from "@/lib/db";
import {
  cancelScheduledNotificationDeliveries,
  dispatchNotification,
} from "@/server/services/notification-dispatcher";
import { NotificationEventService } from "@/server/services/notification-event-service";

const dispatchMock = dispatchNotification as Mock;
const cancelScheduledMock = cancelScheduledNotificationDeliveries as Mock;
const findAdminsMock = db.user.findMany as Mock;
const findUserMock = db.user.findUnique as Mock;

describe("NotificationEventService recipient matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchMock.mockResolvedValue({ ok: true, notifications: 1, deliveries: 1 });
    cancelScheduledMock.mockResolvedValue({ ok: true, count: 2 });
  });

  it("notifies the account customer, assigned staff, and each admin once for a paid appointment", async () => {
    findAdminsMock.mockResolvedValue([
      { id: "admin-1", email: "admin-1@example.com" },
      { id: "admin-2", email: "admin-2@example.com" },
    ]);

    await NotificationEventService.appointmentPaid({
      appointmentId: "appointment-1",
      paymentId: "payment-1",
      serviceName: "Corte",
      customerName: "Ada",
      customer: { id: "student-1", email: "student@example.com" },
      staff: { id: "staff-1", email: "staff@example.com" },
    });

    expect(findAdminsMock).toHaveBeenCalledWith({
      where: { role: "ADMIN", id: { notIn: ["staff-1"] } },
      select: { id: true, email: true },
    });
    expect(dispatchMock).toHaveBeenCalledTimes(3);

    const dispatches = dispatchMock.mock.calls.map(([input]) => input);
    const customerDispatch = dispatches.find(
      (input) => input.actionUrl === "/booking"
    );
    const staffDispatch = dispatches.find(
      (input) => input.actionUrl === "/staff/appointments"
    );
    const adminDispatch = dispatches.find(
      (input) => input.actionUrl === "/admin/appointments"
    );

    expect(customerDispatch).toMatchObject({
      eventKey: "appointment.paid",
      recipients: [
        {
          userId: "student-1",
          email: "student@example.com",
          channels: [
            NotificationDeliveryChannel.IN_APP,
            NotificationDeliveryChannel.EMAIL,
          ],
        },
      ],
    });
    expect(staffDispatch).toMatchObject({
      recipients: [
        {
          userId: "staff-1",
          email: "staff@example.com",
          channels: [
            NotificationDeliveryChannel.IN_APP,
            NotificationDeliveryChannel.EMAIL,
          ],
        },
      ],
    });
    expect(adminDispatch).toMatchObject({
      recipients: [{ userId: "admin-1" }, { userId: "admin-2" }],
      channels: [NotificationDeliveryChannel.IN_APP],
      priority: NotificationPriority.HIGH,
    });

    const recipientIds = dispatches.flatMap((input) =>
      input.recipients.map((recipient: { userId?: string }) => recipient.userId)
    );
    expect(recipientIds.filter((id) => id === "staff-1")).toHaveLength(1);
  });

  it.each(["CANCELLED", "NO_SHOW"] as const)(
    "notifies ADMIN and cancels reminders when an appointment becomes %s",
    async (status) => {
      findAdminsMock.mockResolvedValue([
        { id: "admin-1", email: "admin-1@example.com" },
      ]);

      await NotificationEventService.appointmentStatusChanged({
        appointmentId: "appointment-1",
        status,
        serviceName: "Corte",
        transitionId: "2026-08-09T12:00:00.000Z",
        customer: { id: "student-1", email: "student@example.com" },
        staff: { id: "staff-1", email: "staff@example.com" },
      });

      expect(dispatchMock).toHaveBeenCalledTimes(3);
      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventKey: "appointment.status_changed",
          actionUrl: "/admin/appointments",
          recipients: [{ userId: "admin-1" }],
          channels: [NotificationDeliveryChannel.IN_APP],
          priority: NotificationPriority.HIGH,
        })
      );
      expect(cancelScheduledMock).toHaveBeenCalledWith({
        resource: { type: "APPOINTMENT", id: "appointment-1" },
      });
    }
  );

  it.each([
    ["STAFF", "staff-owner", "/staff/payment-links"],
    ["ADMIN", "admin-owner", "/admin/payment-links"],
  ] as const)(
    "sends a payment-link event only to its %s creator",
    async (role, ownerId, actionUrl) => {
      findUserMock.mockResolvedValue({
        id: ownerId,
        email: `${ownerId}@example.com`,
        role,
      });
      // No other admin exists, so the documented admin in-app broadcast for
      // `payment_link.paid` adds no extra recipient here.
      findAdminsMock.mockResolvedValue([]);

      await NotificationEventService.paymentLinkLifecycle({
        eventKey: "payment_link.paid",
        paymentLinkId: "payment-link-1",
        paymentId: "payment-1",
        title: "Abono",
        createdById: ownerId,
      });

      // Admins are looked up for the paid broadcast, but never the creator:
      // the owner must not receive a duplicate notification.
      expect(findAdminsMock).toHaveBeenCalledWith({
        where: { role: "ADMIN", id: { notIn: [ownerId] } },
        select: { id: true, email: true },
      });
      expect(dispatchMock).toHaveBeenCalledTimes(1);
      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventKey: "payment_link.paid",
          actionUrl,
          recipients: [
            {
              userId: ownerId,
              email: `${ownerId}@example.com`,
              channels: [
                NotificationDeliveryChannel.IN_APP,
                NotificationDeliveryChannel.EMAIL,
              ],
            },
          ],
        })
      );
    }
  );

  it("dispatches an optional in-app recognition only to the student who earned it", async () => {
    findUserMock.mockResolvedValue({
      id: "student-1",
      email: "student@example.com",
      role: "STUDENT",
    });

    await NotificationEventService.achievementEarned({
      achievementId: "achievement-1",
      userId: "student-1",
      achievementName: "Primer paso",
    });

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "achievement.earned",
        type: "ACHIEVEMENT",
        recipients: [{ userId: "student-1" }],
        channels: [NotificationDeliveryChannel.IN_APP],
        resource: { type: "ACHIEVEMENT", id: "achievement-1" },
        actionUrl: "/student",
        priority: NotificationPriority.LOW,
        preferenceCategory: NotificationPreferenceCategory.ACHIEVEMENTS,
        dedupeKey: "achievement:achievement-1:earned",
      }),
    );
  });
});
