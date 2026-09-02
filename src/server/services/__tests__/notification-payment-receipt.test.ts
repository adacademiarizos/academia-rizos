import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateReceiptMarker, dispatchNotificationMock } = vi.hoisted(() => {
  const updateReceiptMarker = vi.fn();
  const dispatchNotificationMock = vi.fn();
  return { updateReceiptMarker, dispatchNotificationMock };
});

vi.mock("@/lib/db", () => ({
  db: {
    payment: {
      updateMany: updateReceiptMarker,
    },
  },
}));

vi.mock("@/server/services/notification-dispatcher", () => ({
  dispatchNotification: dispatchNotificationMock,
  cancelScheduledNotificationDeliveries: vi.fn(),
}));

import { NotificationDeliveryChannel } from "@prisma/client";

import { NotificationEventService } from "@/server/services/notification-event-service";

describe("NotificationEventService.paymentReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchNotificationMock.mockResolvedValue({ ok: true, notifications: 0, deliveries: 1 });
    updateReceiptMarker.mockResolvedValue({ count: 1 });
  });

  it("persists the email delivery first, then records the legacy marker as outbox-queued", async () => {
    const result = await NotificationEventService.paymentReceipt({
      paymentId: "payment-1",
      concept: "Curso",
      amountLabel: "15.00 EUR",
      payer: { id: "student-1", email: "student-account@example.com" },
      payerEmail: "checkout@example.com",
      actionUrl: "/courses/course-1",
    });

    expect(dispatchNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment.receipt",
        dedupeKey: "payment:payment-1:receipt",
        recipients: [
          {
            userId: "student-1",
            email: "checkout@example.com",
            channels: [NotificationDeliveryChannel.EMAIL],
          },
        ],
      }),
    );
    expect(updateReceiptMarker).toHaveBeenCalledWith({
      where: { id: "payment-1", receiptEmailSentAt: null },
      data: {
        receiptEmailSentAt: expect.any(Date),
        receiptToEmail: "checkout@example.com",
      },
    });
    expect(result).toEqual({ queued: true, markerRecorded: true });
  });

  it("does not mark the payment when the outbox cannot be persisted", async () => {
    dispatchNotificationMock.mockResolvedValue({
      ok: false,
      notifications: 0,
      deliveries: 0,
      error: "NOTIFICATION_DISPATCH_FAILED",
    });

    const result = await NotificationEventService.paymentReceipt({
      paymentId: "payment-1",
      concept: "Cita",
      amountLabel: "5.00 EUR",
      payerEmail: "guest@example.com",
      actionUrl: "/booking",
    });

    expect(updateReceiptMarker).not.toHaveBeenCalled();
    expect(result).toEqual({
      queued: false,
      markerRecorded: false,
      error: "NOTIFICATION_DISPATCH_FAILED",
    });
  });

  it("keeps the queued outbox delivery when recording the legacy marker fails", async () => {
    updateReceiptMarker.mockRejectedValue(new Error("temporary database error"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await NotificationEventService.paymentReceipt({
      paymentId: "payment-1",
      concept: "Pago",
      amountLabel: "10.00 EUR",
      payerEmail: "guest@example.com",
      actionUrl: "/pay/link-1",
    });

    expect(result).toEqual({
      queued: true,
      markerRecorded: false,
      error: "Failed to record receipt outbox marker: temporary database error",
    });
    errorSpy.mockRestore();
  });
});
