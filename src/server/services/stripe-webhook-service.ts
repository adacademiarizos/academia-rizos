import type Stripe from "stripe";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { CourseService } from "@/server/services/course-service";
import { NotificationEventService } from "@/server/services/notification-event-service";
import { AchievementService } from "@/server/services/achievement-service";

type DeferredTask = () => Promise<unknown>;

type PaymentMetadata = Record<string, unknown>;

type PaymentContext = Awaited<ReturnType<typeof getPaymentContext>>;

const PAYMENT_STATUSES_THAT_STAY_PAID = new Set<string>(["REFUNDED", "CANCELED"]);
const RETRYABLE_PAYMENT_STATUSES: PaymentStatus[] = [
  "REQUIRES_PAYMENT",
  "PROCESSING",
  "FAILED",
];

function metadataFrom(value: unknown): PaymentMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as PaymentMetadata;
}

function omitKeys(metadata: PaymentMetadata, keys: string[]) {
  const next = { ...metadata };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

function jsonValue(metadata: PaymentMetadata): Prisma.InputJsonValue {
  return metadata as Prisma.InputJsonValue;
}

function queueTask(tasks: DeferredTask[], label: string, task: () => Promise<unknown>) {
  tasks.push(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[stripe webhook] ${label}`, error);
    }
  });
}

function formatMoney(amountCents: number, currency: string) {
  return `${(amountCents / 100).toFixed(2)} ${currency}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("es-ES", { dateStyle: "long" });
}

function formatUnixDate(timestamp: number | null | undefined) {
  if (!timestamp) {
    return "—";
  }

  return formatDate(new Date(timestamp * 1000));
}

function paymentConcept(type: string) {
  if (type === "APPOINTMENT") return "Cita";
  if (type === "COURSE") return "Curso";
  return "Pago";
}

function buildInternalPaymentActionUrl(payment: PaymentContext) {
  if (payment.type === "COURSE" && payment.courseId) {
    return `/courses/${payment.courseId}`;
  }

  if (payment.type === "PAYMENT_LINK" && payment.paymentLinkId) {
    return `/pay/${payment.paymentLinkId}`;
  }

  return "/booking";
}

async function getPaymentContext(paymentId: string) {
  return db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      appointment: {
        select: {
          id: true,
          status: true,
          customerId: true,
          customerName: true,
          customerEmail: true,
          customer: { select: { id: true, email: true } },
          startAt: true,
          endAt: true,
          notes: true,
          updatedAt: true,
          service: { select: { name: true } },
          staff: { select: { id: true, name: true, email: true } },
        },
      },
      course: {
        select: { id: true, title: true },
      },
      payer: {
        select: { id: true, name: true, email: true },
      },
      paymentLink: {
        select: { id: true, title: true, status: true, createdById: true },
      },
    },
  });
}

async function findPaymentByChargeOrIntent({
  chargeId,
  paymentIntentId,
}: {
  chargeId?: string | null;
  paymentIntentId?: string | null;
}) {
  if (chargeId) {
    const byCharge = await db.payment.findUnique({
      where: { stripeChargeId: chargeId },
    });
    if (byCharge) {
      return byCharge;
    }
  }

  if (paymentIntentId) {
    return db.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
  }

  return null;
}

async function findPaymentForFailedIntent(paymentIntent: Stripe.PaymentIntent) {
  const direct = await db.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
  });
  if (direct) {
    return direct;
  }

  const metadata = metadataFrom(paymentIntent.metadata);
  const type = typeof metadata.type === "string" ? metadata.type : undefined;

  if (!type) {
    return null;
  }

  const whereBase = {
    type: type as "APPOINTMENT" | "COURSE" | "PAYMENT_LINK",
    status: {
      in: RETRYABLE_PAYMENT_STATUSES,
    },
  };

  if (type === "APPOINTMENT" && typeof metadata.appointmentId === "string") {
    return db.payment.findFirst({
      where: {
        ...whereBase,
        appointmentId: metadata.appointmentId,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (type === "COURSE" && typeof metadata.courseId === "string") {
    return db.payment.findFirst({
      where: {
        ...whereBase,
        courseId: metadata.courseId,
        payerId: typeof metadata.userId === "string" ? metadata.userId : undefined,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (type === "PAYMENT_LINK" && typeof metadata.paymentLinkId === "string") {
    return db.payment.findFirst({
      where: {
        ...whereBase,
        paymentLinkId: metadata.paymentLinkId,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return null;
}

async function resolvePaymentIntentIdFromDispute(dispute: Stripe.Dispute) {
  const disputeWithIntent = dispute as Stripe.Dispute & {
    payment_intent?: string | Stripe.PaymentIntent | null;
  };

  if (typeof disputeWithIntent.payment_intent === "string") {
    return disputeWithIntent.payment_intent;
  }

  if (
    disputeWithIntent.payment_intent &&
    typeof disputeWithIntent.payment_intent === "object" &&
    "id" in disputeWithIntent.payment_intent
  ) {
    return disputeWithIntent.payment_intent.id;
  }

  if (typeof dispute.charge !== "string") {
    return null;
  }

  try {
    const charge = await stripe.charges.retrieve(dispute.charge);
    if (typeof charge.payment_intent === "string") {
      return charge.payment_intent;
    }

    if (charge.payment_intent && typeof charge.payment_intent === "object") {
      return charge.payment_intent.id;
    }
  } catch (error) {
    console.error("[stripe webhook] dispute charge lookup failed", error);
  }

  return null;
}

async function queuePaymentReceipt(tasks: DeferredTask[], payment: PaymentContext, payerEmail: string) {
  if (payment.receiptEmailSentAt) {
    return;
  }

  queueTask(tasks, "payment receipt notification failed", async () => {
    await NotificationEventService.paymentReceipt({
      paymentId: payment.id,
      concept: paymentConcept(payment.type),
      amountLabel: formatMoney(payment.amountCents, payment.currency),
      payer: payment.payer,
      payerEmail,
      actionUrl: buildInternalPaymentActionUrl(payment),
    });
  });
}

async function queueAppointmentConfirmationTasks(
  tasks: DeferredTask[],
  payment: PaymentContext,
) {
  if (
    !payment.appointment ||
    payment.status !== "PAID" ||
    payment.appointment.status === "CANCELLED"
  ) {
    return;
  }

  const customerEmail = payment.appointment.customerEmail ?? payment.payerEmail ?? undefined;
  const customerName = payment.appointment.customerName ?? payment.payer?.name ?? "Cliente";
  const serviceName = payment.appointment.service?.name ?? "Servicio";
  queueTask(tasks, "paid appointment notification failed", async () => {
    await NotificationEventService.appointmentPaid({
      appointmentId: payment.appointment!.id,
      paymentId: payment.id,
      serviceName,
      customerName,
      customer: payment.appointment!.customer,
      customerEmail,
      staff: payment.appointment!.staff,
    });
  });
}

async function queueCourseEnrollmentTasks(tasks: DeferredTask[], payment: PaymentContext) {
  if (
    payment.type !== "COURSE" ||
    payment.status !== "PAID" ||
    !payment.courseId ||
    !payment.payerId
  ) {
    return;
  }

  // Course access itself emits the student event through CourseService. Normal
  // purchases do not fan out operational payment alerts to every admin.
  queueTask(tasks, "course enrollment activity failed", async () => {
    await AchievementService.recordActivity(payment.payerId!, "COURSE_STARTED", payment.courseId!);
  });
}

async function queuePaymentFailedTasks(tasks: DeferredTask[], payment: PaymentContext, failureReason?: string) {
  const concept = paymentConcept(payment.type);
  const customerName =
    payment.payer?.name ?? payment.appointment?.customerName ?? "cliente";

  queueTask(tasks, "payment failed notification failed", async () => {
    await Promise.all([
      NotificationEventService.paymentForPayer({
        eventKey: "payment.failed",
        paymentId: payment.id,
        title: "No se pudo completar tu pago",
        message: `No se pudo completar tu pago de ${concept.toLowerCase()}. Puedes intentarlo de nuevo.`,
        payer: payment.payer,
        payerEmail: payment.payerEmail,
        actionUrl: buildInternalPaymentActionUrl(payment),
      }),
      NotificationEventService.paymentException({
        eventKey: "payment.failed",
        paymentId: payment.id,
        title: "Pago fallido",
        message: `${customerName} no pudo completar un pago de ${concept.toLowerCase()}${
          failureReason ? `: ${failureReason}` : "."
        }`,
      }),
      ...(payment.paymentLink?.createdById
        ? [
            NotificationEventService.paymentLinkLifecycle({
              eventKey: "payment_link.failed",
              paymentLinkId: payment.paymentLink.id,
              paymentId: payment.id,
              title: payment.paymentLink.title,
              createdById: payment.paymentLink.createdById,
            }),
          ]
        : []),
    ]);
  });
}

async function queueAppointmentRefundTasks(
  tasks: DeferredTask[],
  payment: PaymentContext,
  reason: string,
  notifyStaffStatusChange: boolean,
) {
  if (!payment.appointment) {
    return;
  }

  const customerName = payment.appointment.customerName ?? payment.payer?.name ?? "Cliente";
  const serviceName = payment.appointment.service?.name ?? "Servicio";
  queueTask(tasks, "appointment refund notification failed", async () => {
    await Promise.all([
      NotificationEventService.paymentForPayer({
        eventKey: "payment.refunded",
        paymentId: payment.id,
        title: "Pago reembolsado",
        message: `Tu pago de la cita de ${serviceName} fue reembolsado.`,
        payer: payment.payer ?? payment.appointment!.customer,
        payerEmail: payment.payerEmail ?? payment.appointment!.customerEmail,
        actionUrl: "/booking",
      }),
      NotificationEventService.paymentException({
        eventKey: "payment.refunded",
        paymentId: payment.id,
        title: "Pago reembolsado",
        message: `${customerName} recibió un reembolso y su cita fue cancelada. Motivo: ${reason}`,
      }),
      ...(notifyStaffStatusChange
        ? [
            NotificationEventService.appointmentStatusChanged({
              appointmentId: payment.appointment!.id,
              status: "CANCELLED",
              serviceName,
              transitionId: payment.appointment!.updatedAt.toISOString(),
              staff: payment.appointment!.staff,
              customer: payment.appointment!.customer,
              customerEmail: payment.appointment!.customerEmail ?? payment.payerEmail,
            }),
          ]
        : []),
    ]);
  });
}

async function queueCourseRefundTasks(
  tasks: DeferredTask[],
  payment: PaymentContext,
  reason: string
) {
  const courseTitle = payment.course?.title ?? "tu curso";
  const payerName = payment.payer?.name ?? payment.payerEmail ?? "Un estudiante";

  queueTask(tasks, "course refund notification failed", async () => {
    await Promise.all([
      NotificationEventService.paymentForPayer({
        eventKey: "payment.refunded",
        paymentId: payment.id,
        title: "Pago reembolsado",
        message: `Tu pago de \"${courseTitle}\" fue reembolsado.`,
        payer: payment.payer,
        payerEmail: payment.payerEmail,
        actionUrl: payment.courseId ? `/courses/${payment.courseId}` : "/courses",
      }),
      NotificationEventService.paymentException({
        eventKey: "payment.refunded",
        paymentId: payment.id,
        title: "Acceso de curso revocado",
        message: `${payerName} perdió acceso a \"${courseTitle}\" porque el pago ya no es válido. Motivo: ${reason}`,
      }),
    ]);
  });
}

async function handleCheckoutSessionCompleted(
  event: Stripe.Event
): Promise<DeferredTask[]> {
  const tasks: DeferredTask[] = [];
  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = metadataFrom(session.metadata);
  const type =
    typeof metadata.type === "string" ? metadata.type : "PAYMENT_LINK";
  const stripeCheckoutSessionId = session.id;
  const stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  const amountTotal = session.amount_total ?? 0;
  const currency = session.currency?.toUpperCase() ?? "EUR";
  const payerEmail = session.customer_details?.email ?? undefined;

  const existingPayment = await db.payment.findUnique({
    where: { stripeCheckoutSessionId },
  });
  // Stripe can redeliver checkout.session.completed. Domain mutations that
  // grant value (course time) or record analytics must run only on the first
  // transition into PAID; notification dispatch remains safe to re-attempt
  // because its recipient-scoped outbox keys are idempotent.
  const wasAlreadyPaid = existingPayment?.status === "PAID";

  let paymentId: string;
  if (existingPayment) {
    const nextStatus = PAYMENT_STATUSES_THAT_STAY_PAID.has(existingPayment.status)
      ? existingPayment.status
      : "PAID";

    const updated = await db.payment.update({
      where: { id: existingPayment.id },
      data: {
        type: existingPayment.type,
        status: nextStatus,
        amountCents: amountTotal,
        currency,
        stripePaymentIntentId: stripePaymentIntentId ?? existingPayment.stripePaymentIntentId,
        payerId:
          existingPayment.payerId ??
          (typeof metadata.userId === "string" ? metadata.userId : null),
        payerEmail: payerEmail ?? existingPayment.payerEmail ?? undefined,
        metadata: jsonValue({
          ...metadataFrom(existingPayment.metadata),
          ...metadata,
        }),
      },
    });
    paymentId = updated.id;
  } else {
    const created = await db.payment.create({
      data: {
        type: type as "APPOINTMENT" | "COURSE" | "PAYMENT_LINK",
        status: "PAID",
        amountCents: amountTotal,
        currency,
        stripeCheckoutSessionId,
        stripePaymentIntentId: stripePaymentIntentId ?? null,
        appointmentId: typeof metadata.appointmentId === "string" ? metadata.appointmentId : null,
        courseId: typeof metadata.courseId === "string" ? metadata.courseId : null,
        paymentLinkId:
          typeof metadata.paymentLinkId === "string" ? metadata.paymentLinkId : null,
        payerId: typeof metadata.userId === "string" ? metadata.userId : null,
        payerEmail: payerEmail ?? null,
        metadata: jsonValue(metadata),
      },
    });
    paymentId = created.id;
  }

  const payment = await getPaymentContext(paymentId);
  const becamePaid = payment.status === "PAID" && !wasAlreadyPaid;

  if (payment.status === "PAID" && payment.appointmentId && payment.appointment) {
    if (payment.appointment.status !== "CONFIRMED" && payment.appointment.status !== "CANCELLED") {
      await db.appointment.update({
        where: { id: payment.appointment.id },
        data: { status: "CONFIRMED" },
      });
    }
    await queueAppointmentConfirmationTasks(
      tasks,
      await getPaymentContext(paymentId),
    );
  }

  if (payment.status === "PAID" && payment.type === "PAYMENT_LINK" && payment.paymentLinkId) {
    await db.paymentLink.update({
      where: { id: payment.paymentLinkId },
      data: { status: "PAID" },
    });

    if (payment.paymentLink?.createdById) {
      queueTask(tasks, "payment link creator notification failed", async () => {
        await NotificationEventService.paymentLinkLifecycle({
          eventKey: "payment_link.paid",
          paymentLinkId: payment.paymentLink!.id,
          paymentId: payment.id,
          title: payment.paymentLink!.title,
          amountLabel: formatMoney(payment.amountCents, payment.currency),
          createdById: payment.paymentLink!.createdById!,
        });
      });
    }
  }

  if (becamePaid && payment.type === "COURSE" && payment.courseId && payment.payerId) {
    await CourseService.createCourseAccess(payment.payerId, payment.courseId);
    await queueCourseEnrollmentTasks(tasks, await getPaymentContext(paymentId));
  }

  if (becamePaid) {
    queueTask(tasks, "conversion event failed", async () => {
      const paymentContext = await getPaymentContext(paymentId);
      const paymentMetadata = metadataFrom(paymentContext.metadata);

      await db.conversionEvent.create({
        data: {
          type:
            paymentContext.type === "APPOINTMENT"
              ? "BOOKING"
              : paymentContext.type === "COURSE"
              ? "COURSE_PURCHASE"
              : "PAYMENT_LINK",
          sessionId:
            typeof paymentMetadata.analyticsSessionId === "string"
              ? paymentMetadata.analyticsSessionId
              : "unknown",
          userId:
            typeof paymentMetadata.userId === "string"
              ? paymentMetadata.userId
              : paymentContext.payerId ?? null,
          referrer:
            typeof paymentMetadata.analyticsReferrer === "string"
              ? paymentMetadata.analyticsReferrer
              : null,
          utmSource:
            typeof paymentMetadata.utmSource === "string"
              ? paymentMetadata.utmSource
              : null,
          utmMedium:
            typeof paymentMetadata.utmMedium === "string"
              ? paymentMetadata.utmMedium
              : null,
          utmCampaign:
            typeof paymentMetadata.utmCampaign === "string"
              ? paymentMetadata.utmCampaign
              : null,
          amountCents: paymentContext.amountCents,
          currency: paymentContext.currency,
          metadata: jsonValue({
            paymentId: paymentContext.id,
            appointmentId: paymentContext.appointmentId,
            courseId: paymentContext.courseId,
            paymentLinkId: paymentContext.paymentLinkId,
          }),
        },
      });
    });
  }

  if (payment.status === "PAID" && payment.payerEmail) {
    await queuePaymentReceipt(tasks, payment, payment.payerEmail);
  }

  return tasks;
}

async function handleCheckoutSessionExpired(
  event: Stripe.Event
): Promise<DeferredTask[]> {
  const tasks: DeferredTask[] = [];
  const session = event.data.object as Stripe.Checkout.Session;
  const payment = await db.payment.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });

  if (!payment) {
    return [];
  }

  if (payment.status === "REQUIRES_PAYMENT" || payment.status === "PROCESSING") {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "CANCELED" },
    });
  }

  const context = await getPaymentContext(payment.id);

  if (context.type === "PAYMENT_LINK" && context.paymentLinkId) {
    await db.paymentLink.update({
      where: { id: context.paymentLinkId },
      data: { status: "CANCELED" },
    });

    if (context.paymentLink?.createdById) {
      queueTask(tasks, "expired payment link notification failed", async () => {
        await NotificationEventService.paymentLinkLifecycle({
          eventKey: "payment_link.expired",
          paymentLinkId: context.paymentLink!.id,
          paymentId: context.id,
          title: context.paymentLink!.title,
          createdById: context.paymentLink!.createdById!,
        });
      });
    }
  }

  if (context.type === "APPOINTMENT" && context.appointment?.status === "PENDING") {
    const updatedAppointment = await db.appointment.update({
      where: { id: context.appointment.id },
      data: { status: "CANCELLED" },
      select: { updatedAt: true },
    });

    queueTask(tasks, "expired appointment notification failed", async () => {
      await NotificationEventService.appointmentStatusChanged({
        appointmentId: context.appointment!.id,
        status: "CANCELLED",
        serviceName: context.appointment!.service?.name ?? "Servicio",
        transitionId: updatedAppointment.updatedAt.toISOString(),
        staff: context.appointment!.staff,
        customer: context.appointment!.customer,
        customerEmail: context.appointment!.customerEmail ?? context.payerEmail,
      });
    });
  }

  return tasks;
}

async function handlePaymentIntentFailed(
  event: Stripe.Event
): Promise<DeferredTask[]> {
  const tasks: DeferredTask[] = [];
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const failureReason = paymentIntent.last_payment_error?.message ?? undefined;
  const metadata = metadataFrom(paymentIntent.metadata);
  const existingPayment = await findPaymentForFailedIntent(paymentIntent);
  const failedPaymentMethod = paymentIntent.last_payment_error?.payment_method;
  const payerEmail =
    paymentIntent.receipt_email ??
    (failedPaymentMethod &&
    typeof failedPaymentMethod === "object" &&
    "billing_details" in failedPaymentMethod
      ? failedPaymentMethod.billing_details?.email ?? null
      : null) ??
    null;

  let paymentId: string;
  if (existingPayment) {
    const nextStatus = PAYMENT_STATUSES_THAT_STAY_PAID.has(existingPayment.status)
      ? existingPayment.status
      : "FAILED";

    const updated = await db.payment.update({
      where: { id: existingPayment.id },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        status: nextStatus,
        amountCents: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        payerId:
          existingPayment.payerId ??
          (typeof metadata.userId === "string" ? metadata.userId : null),
        payerEmail: payerEmail ?? existingPayment.payerEmail ?? undefined,
        metadata: jsonValue({
          ...metadataFrom(existingPayment.metadata),
          ...metadata,
          failureReason: failureReason ?? null,
          failureCode: paymentIntent.last_payment_error?.code ?? null,
        }),
      },
    });
    paymentId = updated.id;
  } else {
    const created = await db.payment.create({
      data: {
        type:
          (typeof metadata.type === "string"
            ? metadata.type
            : "PAYMENT_LINK") as "APPOINTMENT" | "COURSE" | "PAYMENT_LINK",
        status: "FAILED",
        amountCents: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        stripePaymentIntentId: paymentIntent.id,
        appointmentId:
          typeof metadata.appointmentId === "string" ? metadata.appointmentId : null,
        courseId: typeof metadata.courseId === "string" ? metadata.courseId : null,
        paymentLinkId:
          typeof metadata.paymentLinkId === "string" ? metadata.paymentLinkId : null,
        payerId: typeof metadata.userId === "string" ? metadata.userId : null,
        payerEmail,
        metadata: jsonValue({
          ...metadata,
          failureReason: failureReason ?? null,
          failureCode: paymentIntent.last_payment_error?.code ?? null,
        }),
      },
    });
    paymentId = created.id;
  }

  const payment = await getPaymentContext(paymentId);

  if (payment.type === "PAYMENT_LINK" && payment.paymentLinkId) {
    await db.paymentLink.update({
      where: { id: payment.paymentLinkId },
      data: { status: "FAILED" },
    });
  }

  await queuePaymentFailedTasks(tasks, payment, failureReason);

  return tasks;
}

async function applyFullRefundState(paymentId: string, reason: string) {
  const payment = await getPaymentContext(paymentId);
  let appointmentStatusChangedToCancelled = false;

  if (payment.status !== "REFUNDED" && payment.status !== "CANCELED") {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED" },
    });
  }

  if (payment.type === "PAYMENT_LINK" && payment.paymentLinkId) {
    await db.paymentLink.update({
      where: { id: payment.paymentLinkId },
      data: { status: "REFUNDED" },
    });
  }

  if (
    payment.type === "APPOINTMENT" &&
    payment.appointment &&
    payment.appointment.status !== "CANCELLED"
  ) {
    const appointment = payment.appointment;
    await db.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED" },
    });
    appointmentStatusChangedToCancelled = true;
  }

  if (payment.type === "COURSE" && payment.payerId && payment.courseId) {
    await CourseService.revokeCourseAccess(payment.payerId, payment.courseId);
  }

  const tasks: DeferredTask[] = [];
  const refreshedPayment = await getPaymentContext(paymentId);

  if (refreshedPayment.type === "APPOINTMENT") {
    await queueAppointmentRefundTasks(
      tasks,
      refreshedPayment,
      reason,
      appointmentStatusChangedToCancelled,
    );
  }

  if (refreshedPayment.type === "COURSE") {
    await queueCourseRefundTasks(tasks, refreshedPayment, reason);
  }

  if (
    refreshedPayment.type === "PAYMENT_LINK" &&
    refreshedPayment.paymentLink?.createdById
  ) {
    queueTask(tasks, "payment link refund notification failed", async () => {
      await Promise.all([
        NotificationEventService.paymentForPayer({
          eventKey: "payment.refunded",
          paymentId: refreshedPayment.id,
          title: "Pago reembolsado",
          message: "Tu pago fue reembolsado.",
          payer: refreshedPayment.payer,
          payerEmail: refreshedPayment.payerEmail,
          actionUrl: `/pay/${refreshedPayment.paymentLinkId}`,
        }),
        NotificationEventService.paymentException({
          eventKey: "payment.refunded",
          paymentId: refreshedPayment.id,
          title: "Pago de link reembolsado",
          message: `El pago del link \"${refreshedPayment.paymentLink!.title}\" fue reembolsado. Motivo: ${reason}`,
        }),
        NotificationEventService.paymentLinkLifecycle({
          eventKey: "payment_link.refunded",
          paymentLinkId: refreshedPayment.paymentLink!.id,
          paymentId: refreshedPayment.id,
          title: refreshedPayment.paymentLink!.title,
          createdById: refreshedPayment.paymentLink!.createdById!,
        }),
      ]);
    });
  }

  return tasks;
}

async function handleChargeRefunded(
  event: Stripe.Event
): Promise<DeferredTask[]> {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  const payment = await findPaymentByChargeOrIntent({
    chargeId: charge.id,
    paymentIntentId,
  });

  if (!payment) {
    return [];
  }

  const isFullRefund = (charge.amount_refunded ?? 0) >= (charge.amount ?? 0);
  const mergedMetadata = {
    ...metadataFrom(payment.metadata),
    refundedAmountCents: charge.amount_refunded ?? 0,
  };

  await db.payment.update({
    where: { id: payment.id },
    data: {
      stripeChargeId: charge.id,
      stripePaymentIntentId: paymentIntentId ?? payment.stripePaymentIntentId,
      status: isFullRefund ? "REFUNDED" : payment.status,
      metadata: jsonValue(mergedMetadata),
    },
  });

  if (!isFullRefund) {
    return [];
  }

  return applyFullRefundState(payment.id, "Reembolso confirmado por Stripe");
}

async function handleDisputeCreated(
  event: Stripe.Event
): Promise<DeferredTask[]> {
  const tasks: DeferredTask[] = [];
  const dispute = event.data.object as Stripe.Dispute;
  const paymentIntentId = await resolvePaymentIntentIdFromDispute(dispute);
  const payment = await findPaymentByChargeOrIntent({
    chargeId: typeof dispute.charge === "string" ? dispute.charge : null,
    paymentIntentId,
  });

  if (!payment) {
    return [];
  }

  const mergedMetadata = {
    ...metadataFrom(payment.metadata),
    disputeId: dispute.id,
    disputeStatus: dispute.status,
    disputeDueBy: dispute.evidence_details?.due_by ?? null,
  };

  await db.payment.update({
    where: { id: payment.id },
    data: {
      stripeChargeId:
        typeof dispute.charge === "string" ? dispute.charge : payment.stripeChargeId,
      stripePaymentIntentId: paymentIntentId ?? payment.stripePaymentIntentId,
      metadata: jsonValue(mergedMetadata),
    },
  });

  const context = await getPaymentContext(payment.id);
  queueTask(tasks, "dispute created notification failed", async () => {
    await NotificationEventService.paymentException({
      eventKey: "payment.dispute_created",
      paymentId: context.id,
      title: "Disputa de pago urgente",
      message: `Stripe abrió una disputa sobre un ${paymentConcept(context.type).toLowerCase()}. Responder antes de ${formatUnixDate(dispute.evidence_details?.due_by)}.`,
      priority: "URGENT",
    });
  });

  return tasks;
}

async function handleDisputeClosed(
  event: Stripe.Event
): Promise<DeferredTask[]> {
  const tasks: DeferredTask[] = [];
  const dispute = event.data.object as Stripe.Dispute;
  const paymentIntentId = await resolvePaymentIntentIdFromDispute(dispute);
  const payment = await findPaymentByChargeOrIntent({
    chargeId: typeof dispute.charge === "string" ? dispute.charge : null,
    paymentIntentId,
  });

  if (!payment) {
    return [];
  }

  if (dispute.status === "lost") {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        metadata: jsonValue({
          ...metadataFrom(payment.metadata),
          disputeId: dispute.id,
          disputeStatus: dispute.status,
          disputeDueBy: dispute.evidence_details?.due_by ?? null,
        }),
      },
    });

    const refundTasks = await applyFullRefundState(payment.id, "Disputa perdida en Stripe");
    refundTasks.push(async () => {
      await NotificationEventService.paymentException({
        eventKey: "payment.dispute_closed",
        paymentId: payment.id,
        title: "Disputa cerrada en contra",
        message: `La disputa ${dispute.id} se cerró en contra del negocio.`,
        priority: "URGENT",
      });
    });
    return refundTasks;
  }

  const cleanedMetadata = omitKeys(metadataFrom(payment.metadata), [
    "disputeId",
    "disputeStatus",
    "disputeDueBy",
  ]);

  await db.payment.update({
    where: { id: payment.id },
    data: {
      status:
        payment.status === "REFUNDED" || payment.status === "CANCELED"
          ? payment.status
          : "PAID",
      metadata: jsonValue(cleanedMetadata),
    },
  });

  const context = await getPaymentContext(payment.id);
  queueTask(tasks, "dispute closed notification failed", async () => {
    await NotificationEventService.paymentException({
      eventKey: "payment.dispute_closed",
      paymentId: context.id,
      title: "Disputa cerrada a favor",
      message: `La disputa ${dispute.id} se cerró a favor del negocio.`,
    });
  });

  return tasks;
}

export async function processStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(event);
    case "checkout.session.expired":
      return handleCheckoutSessionExpired(event);
    case "payment_intent.payment_failed":
      return handlePaymentIntentFailed(event);
    case "charge.refunded":
      return handleChargeRefunded(event);
    case "charge.dispute.created":
      return handleDisputeCreated(event);
    case "charge.dispute.closed":
      return handleDisputeClosed(event);
    default:
      return [];
  }
}
