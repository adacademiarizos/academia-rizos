import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const db = {
  payment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  paymentLink: { update: jest.fn() },
  appointment: { update: jest.fn() },
  conversionEvent: { create: jest.fn() },
};

const stripeChargesRetrieve = jest.fn();

const CourseService = {
  createCourseAccess: jest.fn(),
  revokeCourseAccess: jest.fn(),
};

const NotificationEventService = {
  appointmentPaid: jest.fn(),
  appointmentStatusChanged: jest.fn(),
  paymentForPayer: jest.fn(),
  paymentException: jest.fn(),
  paymentLinkLifecycle: jest.fn(),
  paymentReceipt: jest.fn(),
};

const AchievementService = {
  recordActivity: jest.fn(),
};

jest.mock("@/lib/db", () => ({ db }));
jest.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://app.example.com" },
}));
jest.mock("@/lib/stripe", () => ({
  stripe: {
    charges: { retrieve: stripeChargesRetrieve },
  },
}));
jest.mock("@/server/services/course-service", () => ({ CourseService }));
jest.mock("@/server/services/notification-event-service", () => ({ NotificationEventService }));
jest.mock("@/server/services/achievement-service", () => ({ AchievementService }));

import { processStripeEvent } from "@/server/services/stripe-webhook-service";

function makePaymentContext(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay_1",
    type: "COURSE",
    status: "PAID",
    amountCents: 15000,
    currency: "EUR",
    stripePaymentIntentId: "pi_1",
    stripeCheckoutSessionId: "cs_1",
    stripeChargeId: "ch_1",
    appointmentId: null,
    courseId: "course_1",
    paymentLinkId: null,
    payerId: "user_1",
    payerEmail: "student@example.com",
    receiptEmailSentAt: null,
    receiptToEmail: null,
    metadata: { analyticsSessionId: "sess_1", userId: "user_1" },
    appointment: null,
    course: { id: "course_1", title: "Rizos 101" },
    payer: { id: "user_1", name: "Ada", email: "student@example.com" },
    paymentLink: null,
    ...overrides,
  };
}

async function runDeferredTasks(tasks: Array<() => Promise<unknown>>) {
  await Promise.all(tasks.map((task) => task()));
}

describe("processStripeEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    db.payment.findUnique.mockResolvedValue(null);
    db.payment.findFirst.mockResolvedValue(null);
    db.payment.findUniqueOrThrow.mockResolvedValue(makePaymentContext());
    db.payment.create.mockResolvedValue({ id: "pay_1" });
    db.payment.update.mockResolvedValue({ id: "pay_1" });
    db.paymentLink.update.mockResolvedValue({});
    db.appointment.update.mockResolvedValue({
      updatedAt: new Date("2026-07-01T12:00:00.000Z"),
    });
    db.conversionEvent.create.mockResolvedValue({});
    CourseService.createCourseAccess.mockResolvedValue({});
    CourseService.revokeCourseAccess.mockResolvedValue({});
    NotificationEventService.appointmentPaid.mockResolvedValue({});
    NotificationEventService.appointmentStatusChanged.mockResolvedValue({});
    NotificationEventService.paymentForPayer.mockResolvedValue({});
    NotificationEventService.paymentException.mockResolvedValue({});
    NotificationEventService.paymentLinkLifecycle.mockResolvedValue({});
    NotificationEventService.paymentReceipt.mockResolvedValue({});
    AchievementService.recordActivity.mockResolvedValue({});
    stripeChargesRetrieve.mockResolvedValue({ payment_intent: "pi_1" });
  });

  it("cancels checkout-session payments and pending appointments on expiration", async () => {
    db.payment.findUnique.mockResolvedValue({
      id: "pay_1",
      status: "REQUIRES_PAYMENT",
    });
    db.payment.findUniqueOrThrow.mockResolvedValue(
      makePaymentContext({
        type: "APPOINTMENT",
        appointmentId: "appt_1",
        appointment: {
          id: "appt_1",
          status: "PENDING",
          customerId: "user_1",
          customerName: "Ada",
          customerEmail: "student@example.com",
          startAt: new Date("2026-07-05T10:00:00Z"),
          endAt: new Date("2026-07-05T11:00:00Z"),
          notes: null,
          service: { name: "Corte" },
          staff: { id: "staff_1", name: "Eli", email: "staff@example.com" },
        },
      })
    );

    const tasks = await processStripeEvent({
      type: "checkout.session.expired",
      data: { object: { id: "cs_1" } },
    } as any);

    expect(db.payment.update).toHaveBeenCalledWith({
      where: { id: "pay_1" },
      data: { status: "CANCELED" },
    });
    expect(db.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: { status: "CANCELLED" },
      select: { updatedAt: true },
    });
    await runDeferredTasks(tasks);
    expect(NotificationEventService.appointmentStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: "appt_1",
        status: "CANCELLED",
        serviceName: "Corte",
        transitionId: "2026-07-01T12:00:00.000Z",
        staff: expect.objectContaining({ id: "staff_1" }),
      })
    );
  });

  it("notifies assigned staff once when a paid appointment is confirmed", async () => {
    db.payment.findUniqueOrThrow.mockResolvedValue(
      makePaymentContext({
        type: "APPOINTMENT",
        appointmentId: "appt_1",
        courseId: null,
        appointment: {
          id: "appt_1",
          status: "PENDING",
          customerId: "user_1",
          customerName: "Ada",
          customerEmail: "student@example.com",
          startAt: new Date("2026-07-05T10:00:00Z"),
          endAt: new Date("2026-07-05T11:00:00Z"),
          notes: null,
          service: { name: "Corte" },
          staff: { id: "staff_1", name: "Eli", email: "staff@example.com" },
        },
      })
    );

    const tasks = await processStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          amount_total: 15000,
          currency: "eur",
          payment_intent: "pi_1",
          customer_details: { email: "student@example.com" },
          metadata: { type: "APPOINTMENT", appointmentId: "appt_1" },
        },
      },
    } as any);

    await runDeferredTasks(tasks);

    expect(NotificationEventService.appointmentPaid).toHaveBeenCalledTimes(1);
    expect(NotificationEventService.appointmentPaid).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: "appt_1",
        paymentId: "pay_1",
        serviceName: "Corte",
        customerName: "Ada",
        staff: expect.objectContaining({ id: "staff_1" }),
      })
    );
    expect(NotificationEventService.paymentException).not.toHaveBeenCalled();
  });

  it("does not grant course access or record conversion again for a repeated paid checkout", async () => {
    db.payment.findUnique.mockResolvedValue({
      id: "pay_1",
      type: "COURSE",
      status: "PAID",
      stripePaymentIntentId: "pi_1",
      payerId: "user_1",
      payerEmail: "student@example.com",
      metadata: { analyticsSessionId: "sess_1", userId: "user_1" },
    });
    db.payment.findUniqueOrThrow.mockResolvedValue(makePaymentContext());

    const tasks = await processStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          amount_total: 15000,
          currency: "eur",
          payment_intent: "pi_1",
          customer_details: { email: "student@example.com" },
          metadata: { type: "COURSE", courseId: "course_1", userId: "user_1" },
        },
      },
    } as any);

    expect(CourseService.createCourseAccess).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(1);

    await runDeferredTasks(tasks);

    expect(db.conversionEvent.create).not.toHaveBeenCalled();
    // Delivery retries are still handed to the semantic service, whose outbox
    // dedupe key makes repeated checkout notifications safe.
    expect(NotificationEventService.paymentReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "pay_1" })
    );
  });

  it("notifies only the paid payment-link creator without a normal admin alert", async () => {
    db.payment.findUniqueOrThrow.mockResolvedValue(
      makePaymentContext({
        type: "PAYMENT_LINK",
        appointmentId: null,
        courseId: null,
        paymentLinkId: "link_1",
        payerId: null,
        paymentLink: {
          id: "link_1",
          title: "Saldo tratamiento",
          status: "REQUIRES_PAYMENT",
          createdById: "staff_1",
        },
      })
    );

    const tasks = await processStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          amount_total: 15000,
          currency: "eur",
          payment_intent: "pi_1",
          customer_details: { email: "student@example.com" },
          metadata: { type: "PAYMENT_LINK", paymentLinkId: "link_1" },
        },
      },
    } as any);

    await runDeferredTasks(tasks);

    expect(NotificationEventService.paymentLinkLifecycle).toHaveBeenCalledTimes(1);
    expect(NotificationEventService.paymentLinkLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment_link.paid",
        paymentLinkId: "link_1",
        paymentId: "pay_1",
        title: "Saldo tratamiento",
        amountLabel: "150.00 EUR",
        createdById: "staff_1",
      })
    );
    expect(NotificationEventService.paymentException).not.toHaveBeenCalled();
  });

  it("marks failed payment intents as FAILED and queues semantic payer/admin events", async () => {
    db.payment.findUnique.mockResolvedValue({
      id: "pay_1",
      status: "REQUIRES_PAYMENT",
      payerId: "user_1",
      payerEmail: "student@example.com",
      metadata: {},
    });
    db.payment.findUniqueOrThrow.mockResolvedValue(
      makePaymentContext({
        type: "COURSE",
        status: "FAILED",
      })
    );

    const tasks = await processStripeEvent({
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_1",
          amount: 15000,
          currency: "eur",
          receipt_email: "student@example.com",
          metadata: { type: "COURSE", courseId: "course_1", userId: "user_1" },
          last_payment_error: { message: "Tarjeta rechazada", code: "card_declined" },
        },
      },
    } as any);

    expect(db.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay_1" },
        data: expect.objectContaining({
          status: "FAILED",
          stripePaymentIntentId: "pi_1",
        }),
      })
    );

    await runDeferredTasks(tasks);

    expect(NotificationEventService.paymentForPayer).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment.failed",
        paymentId: "pay_1",
        actionUrl: "/courses/course_1",
      })
    );
    expect(NotificationEventService.paymentException).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment.failed",
        paymentId: "pay_1",
        title: "Pago fallido",
      })
    );
  });

  it("records partial refunds without revoking access", async () => {
    db.payment.findUnique.mockResolvedValue({
      id: "pay_1",
      status: "PAID",
      stripePaymentIntentId: "pi_1",
      metadata: {},
    });

    const tasks = await processStripeEvent({
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_1",
          amount: 15000,
          amount_refunded: 5000,
          payment_intent: "pi_1",
        },
      },
    } as any);

    expect(db.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay_1" },
        data: expect.objectContaining({
          stripeChargeId: "ch_1",
          metadata: expect.objectContaining({ refundedAmountCents: 5000 }),
        }),
      })
    );
    expect(CourseService.revokeCourseAccess).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(0);
  });

  it("treats full course refunds as access revocations and queues semantic payer/admin events", async () => {
    db.payment.findUnique.mockResolvedValue({
      id: "pay_1",
      status: "PAID",
      stripePaymentIntentId: "pi_1",
      metadata: {},
    });
    db.payment.findUniqueOrThrow.mockResolvedValue(
      makePaymentContext({
        type: "COURSE",
        status: "REFUNDED",
      })
    );

    const tasks = await processStripeEvent({
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_1",
          amount: 15000,
          amount_refunded: 15000,
          payment_intent: "pi_1",
        },
      },
    } as any);

    expect(CourseService.revokeCourseAccess).toHaveBeenCalledWith("user_1", "course_1");

    await runDeferredTasks(tasks);

    expect(NotificationEventService.paymentForPayer).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment.refunded",
        paymentId: "pay_1",
        actionUrl: "/courses/course_1",
      })
    );
    expect(NotificationEventService.paymentException).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment.refunded",
        paymentId: "pay_1",
        title: "Acceso de curso revocado",
      })
    );
  });

  it("creates urgent admin alerts when a dispute opens", async () => {
    db.payment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "pay_1",
        status: "PAID",
        stripePaymentIntentId: "pi_1",
        metadata: {},
        stripeChargeId: null,
      });

    const tasks = await processStripeEvent({
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_1",
          charge: "ch_1",
          status: "warning_needs_response",
          evidence_details: { due_by: 1780000000 },
        },
      },
    } as any);

    await runDeferredTasks(tasks);

    expect(NotificationEventService.paymentException).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment.dispute_created",
        paymentId: "pay_1",
        title: "Disputa de pago urgente",
        priority: "URGENT",
      })
    );
  });

  it("reuses refund logic when a dispute is lost", async () => {
    db.payment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "pay_1",
        status: "PAID",
        stripePaymentIntentId: "pi_1",
        metadata: {},
        stripeChargeId: null,
      });
    db.payment.findUniqueOrThrow.mockResolvedValue(
      makePaymentContext({
        type: "COURSE",
        status: "REFUNDED",
      })
    );

    const tasks = await processStripeEvent({
      type: "charge.dispute.closed",
      data: {
        object: {
          id: "dp_1",
          charge: "ch_1",
          status: "lost",
          evidence_details: { due_by: 1780000000 },
        },
      },
    } as any);

    expect(CourseService.revokeCourseAccess).toHaveBeenCalledWith("user_1", "course_1");

    await runDeferredTasks(tasks);

    expect(NotificationEventService.paymentForPayer).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment.refunded",
        paymentId: "pay_1",
      })
    );
    expect(NotificationEventService.paymentException).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment.dispute_closed",
        paymentId: "pay_1",
        title: "Disputa cerrada en contra",
        priority: "URGENT",
      })
    );
  });

  it("cleans dispute metadata and notifies admins when a dispute is won", async () => {
    db.payment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "pay_1",
        status: "PAID",
        stripePaymentIntentId: "pi_1",
        metadata: {
          disputeId: "dp_1",
          disputeStatus: "warning_needs_response",
          disputeDueBy: 1780000000,
        },
        stripeChargeId: null,
      });

    const tasks = await processStripeEvent({
      type: "charge.dispute.closed",
      data: {
        object: {
          id: "dp_1",
          charge: "ch_1",
          status: "won",
          evidence_details: { due_by: 1780000000 },
        },
      },
    } as any);

    expect(db.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay_1" },
        data: expect.objectContaining({
          status: "PAID",
        }),
      })
    );

    await runDeferredTasks(tasks);

    expect(NotificationEventService.paymentException).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment.dispute_closed",
        paymentId: "pay_1",
        title: "Disputa cerrada a favor",
      })
    );
  });
});
