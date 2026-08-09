const findPendingReceipts = jest.fn();
const queuePaymentReceipt = jest.fn();

jest.mock("@/lib/db", () => ({
  db: {
    payment: {
      findMany: findPendingReceipts,
    },
  },
}));

jest.mock("@/server/services/notification-event-service", () => ({
  NotificationEventService: {
    paymentReceipt: queuePaymentReceipt,
  },
}));

import { sendReceiptJob } from "@/server/jobs/sendReceipt.job";

describe("sendReceiptJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queuePaymentReceipt.mockResolvedValue({ queued: true, markerRecorded: true });
  });

  it("queues each pending receipt through the durable notification outbox", async () => {
    findPendingReceipts.mockResolvedValue([
      {
        id: "payment-course",
        type: "COURSE",
        amountCents: 1500,
        currency: "EUR",
        payerEmail: "student@example.com",
        courseId: "course-1",
        paymentLinkId: null,
      },
      {
        id: "payment-link",
        type: "PAYMENT_LINK",
        amountCents: 2800,
        currency: "USD",
        payerEmail: "guest@example.com",
        courseId: null,
        paymentLinkId: "link-1",
      },
    ]);

    const result = await sendReceiptJob();

    expect(findPendingReceipts).toHaveBeenCalledWith({
      where: {
        status: "PAID",
        receiptEmailSentAt: null,
        payerEmail: { not: null },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        amountCents: true,
        currency: true,
        payerEmail: true,
        courseId: true,
        paymentLinkId: true,
      },
    });
    expect(queuePaymentReceipt).toHaveBeenNthCalledWith(1, {
      paymentId: "payment-course",
      concept: "Curso",
      amountLabel: "15.00 EUR",
      payerEmail: "student@example.com",
      actionUrl: "/courses/course-1",
    });
    expect(queuePaymentReceipt).toHaveBeenNthCalledWith(2, {
      paymentId: "payment-link",
      concept: "Pago",
      amountLabel: "28.00 USD",
      payerEmail: "guest@example.com",
      actionUrl: "/pay/link-1",
    });
    expect(result).toEqual({ processed: 2, errors: [] });
  });

  it("records an enqueue failure and continues with the remaining receipts", async () => {
    findPendingReceipts.mockResolvedValue([
      {
        id: "payment-failed",
        type: "APPOINTMENT",
        amountCents: 500,
        currency: "EUR",
        payerEmail: "first@example.com",
        courseId: null,
        paymentLinkId: null,
      },
      {
        id: "payment-ok",
        type: "APPOINTMENT",
        amountCents: 700,
        currency: "EUR",
        payerEmail: "second@example.com",
        courseId: null,
        paymentLinkId: null,
      },
    ]);
    queuePaymentReceipt
      .mockResolvedValueOnce({
        queued: false,
        markerRecorded: false,
        error: "NOTIFICATION_DISPATCH_FAILED",
      })
      .mockResolvedValueOnce({ queued: true, markerRecorded: true });

    const result = await sendReceiptJob();

    expect(queuePaymentReceipt).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      processed: 1,
      errors: [
        "Failed to queue receipt for payment payment-failed: NOTIFICATION_DISPATCH_FAILED",
      ],
    });
  });
});
