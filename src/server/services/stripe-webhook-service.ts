import type Stripe from "stripe";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import {
  sendAdminAlertEmail,
  sendAppointmentCancelledEmail,
  sendAppointmentConfirmationEmail,
  sendAppointmentNotificationEmail,
  sendPaymentFailedEmail,
  sendPaymentReceiptEmail,
} from "@/lib/mail";
import { CourseService } from "@/server/services/course-service";
import { NotificationService } from "@/server/services/notification-service";
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

function buildRetryUrl(payment: PaymentContext) {
  if (payment.type === "COURSE" && payment.courseId) {
    return `${env.NEXT_PUBLIC_APP_URL}/courses/${payment.courseId}`;
  }

  if (payment.type === "PAYMENT_LINK" && payment.paymentLinkId) {
    return `${env.NEXT_PUBLIC_APP_URL}/pay/${payment.paymentLinkId}`;
  }

  if (payment.type === "APPOINTMENT") {
    return `${env.NEXT_PUBLIC_APP_URL}/booking`;
  }

  return undefined;
}

async function getAdminEmails() {
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });

  return admins.map((admin) => admin.email);
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
          startAt: true,
          endAt: true,
          notes: true,
          service: { select: { name: true } },
          staff: { select: { name: true, email: true } },
        },
      },
      course: {
        select: { id: true, title: true },
      },
      payer: {
        select: { id: true, name: true, email: true },
      },
      paymentLink: {
        select: { id: true, title: true, status: true },
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

  queueTask(tasks, "payment receipt email failed", async () => {
    await sendPaymentReceiptEmail({
      to: payerEmail,
      paymentId: payment.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
      concept: paymentConcept(payment.type),
      stripePaymentIntentId: payment.stripePaymentIntentId ?? undefined,
    });

    await db.payment.update({
      where: { id: payment.id },
      data: {
        receiptEmailSentAt: new Date(),
        receiptToEmail: payerEmail,
      },
    });
  });
}

async function queueAppointmentConfirmationTasks(tasks: DeferredTask[], payment: PaymentContext) {
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
  const staffName = payment.appointment.staff?.name ?? "Especialista";

  if (customerEmail) {
    queueTask(tasks, "appointment confirmation email failed", async () => {
      await sendAppointmentConfirmationEmail({
        to: customerEmail,
        customerName,
        serviceName,
        staffName,
        startAt: payment.appointment!.startAt,
        endAt: payment.appointment!.endAt,
        notes: payment.appointment!.notes ?? undefined,
      });
    });
  }

  const adminEmails = await getAdminEmails();
  const notifyRecipients = [
    ...(payment.appointment.staff?.email ? [payment.appointment.staff.email] : []),
    ...adminEmails,
  ].filter((email, index, list) => list.indexOf(email) === index);

  if (notifyRecipients.length > 0 && customerEmail) {
    queueTask(tasks, "appointment staff notification email failed", async () => {
      await sendAppointmentNotificationEmail({
        to: notifyRecipients,
        customerName,
        customerEmail,
        serviceName,
        staffName,
        startAt: payment.appointment!.startAt,
        endAt: payment.appointment!.endAt,
        notes: payment.appointment!.notes ?? undefined,
      });
    });
  }

  if (payment.appointment.customerId) {
    queueTask(tasks, "appointment customer notification failed", async () => {
      await NotificationService.createNotification({
        userId: payment.appointment!.customerId!,
        type: "APPOINTMENT",
        title: "Cita confirmada",
        message: `Tu cita de ${serviceName} fue confirmada`,
        relatedId: payment.appointment!.id,
      });
    });
  }

  queueTask(tasks, "appointment admin notification failed", async () => {
    await NotificationService.notifyAllAdmins({
      type: "APPOINTMENT",
      title: "Nueva cita reservada",
      message: `${customerName} reservó ${serviceName}`,
      relatedId: payment.appointment!.id,
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

  const adminEmails = await getAdminEmails();
  const courseTitle = payment.course?.title ?? "un curso";
  const payerName = payment.payer?.name ?? payment.payerEmail ?? "Un estudiante";
  const payerEmail = payment.payer?.email ?? payment.payerEmail ?? "—";

  if (adminEmails.length > 0) {
    queueTask(tasks, "course purchase admin email failed", async () => {
      await sendAdminAlertEmail({
        to: adminEmails,
        subject: `Nuevo pago de curso — ${courseTitle}`,
        title: "Curso adquirido",
        rows: [
          ["Curso", courseTitle],
          ["Estudiante", payerName],
          ["Email", payerEmail],
          ["Monto", formatMoney(payment.amountCents, payment.currency)],
          ["Fecha", formatDate(new Date())],
        ],
      });
    });
  }

  queueTask(tasks, "course purchase admin notification failed", async () => {
    await NotificationService.notifyAllAdmins({
      type: "PAYMENT",
      title: "Nuevo pago de curso",
      message: `${payerName} compró "${courseTitle}"`,
      relatedId: payment.courseId!,
    });
  });

  queueTask(tasks, "course enrollment notifications failed", async () => {
    await Promise.all([
      NotificationService.triggerOnCourseEnrollment(payment.payerId!, payment.courseId!),
      AchievementService.recordActivity(payment.payerId!, "COURSE_STARTED", payment.courseId!),
    ]);
  });
}

async function queuePaymentFailedTasks(tasks: DeferredTask[], payment: PaymentContext, failureReason?: string) {
  const concept = paymentConcept(payment.type);
  const customerName =
    payment.payer?.name ?? payment.appointment?.customerName ?? "cliente";

  if (payment.payerEmail) {
    queueTask(tasks, "payment failed email failed", async () => {
      await sendPaymentFailedEmail({
        to: payment.payerEmail!,
        customerName,
        concept,
        amountCents: payment.amountCents,
        currency: payment.currency,
        failureReason,
        retryUrl: buildRetryUrl(payment),
      });
    });
  }

  queueTask(tasks, "payment failed admin notification failed", async () => {
    await NotificationService.notifyAllAdmins({
      type: "PAYMENT",
      title: "Pago fallido",
      message: `${customerName} no pudo completar un pago de ${concept.toLowerCase()}`,
      relatedId: payment.id,
    });
  });
}

async function queueAppointmentRefundTasks(
  tasks: DeferredTask[],
  payment: PaymentContext,
  reason: string
) {
  if (!payment.appointment) {
    return;
  }

  const customerEmail = payment.appointment.customerEmail ?? payment.payerEmail ?? undefined;
  const customerName = payment.appointment.customerName ?? payment.payer?.name ?? "Cliente";
  const serviceName = payment.appointment.service?.name ?? "Servicio";
  const staffName = payment.appointment.staff?.name ?? "Especialista";
  const adminEmails = await getAdminEmails();
  const recipients = [
    ...(payment.appointment.staff?.email ? [payment.appointment.staff.email] : []),
    ...adminEmails,
  ].filter((email, index, list) => list.indexOf(email) === index);

  if (customerEmail) {
    queueTask(tasks, "appointment cancellation email failed", async () => {
      await sendAppointmentCancelledEmail({
        to: customerEmail,
        customerName,
        serviceName,
        staffName,
        startAt: payment.appointment!.startAt,
        endAt: payment.appointment!.endAt,
        reason,
      });
    });
  }

  if (payment.appointment.customerId) {
    queueTask(tasks, "appointment refund customer notification failed", async () => {
      await NotificationService.createNotification({
        userId: payment.appointment!.customerId!,
        type: "APPOINTMENT",
        title: "Cita cancelada",
        message: `Tu cita de ${serviceName} fue cancelada porque el pago ya no es válido`,
        relatedId: payment.appointment!.id,
      });
    });
  }

  if (recipients.length > 0) {
    queueTask(tasks, "appointment refund admin email failed", async () => {
      await sendAdminAlertEmail({
        to: recipients,
        subject: `Cita cancelada por reembolso — ${serviceName}`,
        title: "Cita cancelada",
        rows: [
          ["Cliente", customerName],
          ["Servicio", serviceName],
          ["Motivo", reason],
          ["Monto", formatMoney(payment.amountCents, payment.currency)],
        ],
      });
    });
  }

  queueTask(tasks, "appointment refund admin notification failed", async () => {
    await NotificationService.notifyAllAdmins({
      type: "PAYMENT",
      title: "Pago reembolsado",
      message: `${customerName} recibió un reembolso y su cita fue cancelada`,
      relatedId: payment.appointment!.id,
    });
  });
}

async function queueCourseRefundTasks(
  tasks: DeferredTask[],
  payment: PaymentContext,
  reason: string
) {
  const courseTitle = payment.course?.title ?? "tu curso";
  const payerName = payment.payer?.name ?? payment.payerEmail ?? "Un estudiante";
  const adminEmails = await getAdminEmails();

  if (payment.payerId && payment.courseId) {
    queueTask(tasks, "course refund student notification failed", async () => {
      await NotificationService.createNotification({
        userId: payment.payerId!,
        type: "PAYMENT",
        title: "Acceso revocado",
        message: `Tu acceso a "${courseTitle}" fue revocado porque el pago ya no es válido`,
        relatedId: payment.courseId!,
      });
    });
  }

  if (adminEmails.length > 0) {
    queueTask(tasks, "course refund admin email failed", async () => {
      await sendAdminAlertEmail({
        to: adminEmails,
        subject: `Pago reembolsado — ${courseTitle}`,
        title: "Acceso de curso revocado",
        rows: [
          ["Curso", courseTitle],
          ["Estudiante", payerName],
          ["Motivo", reason],
          ["Monto", formatMoney(payment.amountCents, payment.currency)],
        ],
      });
    });
  }

  queueTask(tasks, "course refund admin notification failed", async () => {
    await NotificationService.notifyAllAdmins({
      type: "PAYMENT",
      title: "Acceso de curso revocado",
      message: `${payerName} perdió acceso a "${courseTitle}" porque el pago ya no es válido`,
      relatedId: payment.courseId ?? undefined,
    });
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

  if (payment.status === "PAID" && payment.appointmentId && payment.appointment) {
    if (payment.appointment.status !== "CONFIRMED" && payment.appointment.status !== "CANCELLED") {
      await db.appointment.update({
        where: { id: payment.appointment.id },
        data: { status: "CONFIRMED" },
      });
    }
    await queueAppointmentConfirmationTasks(tasks, await getPaymentContext(paymentId));
  }

  if (payment.status === "PAID" && payment.type === "PAYMENT_LINK" && payment.paymentLinkId) {
    await db.paymentLink.update({
      where: { id: payment.paymentLinkId },
      data: { status: "PAID" },
    });
  }

  if (payment.status === "PAID" && payment.type === "COURSE" && payment.courseId && payment.payerId) {
    await CourseService.createCourseAccess(payment.payerId, payment.courseId);
    await queueCourseEnrollmentTasks(tasks, await getPaymentContext(paymentId));
  }

  if (payment.status === "PAID") {
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

  if (payment.status === "PAID" && payment.type !== "COURSE") {
    queueTask(tasks, "payment admin notification failed", async () => {
      await NotificationService.notifyAllAdmins({
        type: "PAYMENT",
        title: "Nuevo pago recibido",
        message: `Pago de ${formatMoney(payment.amountCents, payment.currency)} — ${paymentConcept(payment.type)}`,
        relatedId: payment.id,
      });
    });
  }

  return tasks;
}

async function handleCheckoutSessionExpired(
  event: Stripe.Event
): Promise<DeferredTask[]> {
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
  }

  if (context.type === "APPOINTMENT" && context.appointment?.status === "PENDING") {
    await db.appointment.update({
      where: { id: context.appointment.id },
      data: { status: "CANCELLED" },
    });
  }

  return [];
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
  }

  if (payment.type === "COURSE" && payment.payerId && payment.courseId) {
    await CourseService.revokeCourseAccess(payment.payerId, payment.courseId);
  }

  const tasks: DeferredTask[] = [];
  const refreshedPayment = await getPaymentContext(paymentId);

  if (refreshedPayment.type === "APPOINTMENT") {
    await queueAppointmentRefundTasks(tasks, refreshedPayment, reason);
  }

  if (refreshedPayment.type === "COURSE") {
    await queueCourseRefundTasks(tasks, refreshedPayment, reason);
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
  const adminEmails = await getAdminEmails();

  if (adminEmails.length > 0) {
    queueTask(tasks, "dispute created admin email failed", async () => {
      await sendAdminAlertEmail({
        to: adminEmails,
        subject: `Disputa de pago — ${paymentConcept(context.type)}`,
        title: "Disputa de pago urgente",
        rows: [
          ["Disputa", dispute.id],
          ["Pago", context.id],
          ["Tipo", paymentConcept(context.type)],
          ["Monto", formatMoney(context.amountCents, context.currency)],
          ["Responder antes de", formatUnixDate(dispute.evidence_details?.due_by)],
        ],
        note: "Revisar la disputa manualmente en Stripe y preparar evidencia antes del vencimiento.",
      });
    });
  }

  queueTask(tasks, "dispute created admin notification failed", async () => {
    await NotificationService.notifyAllAdmins({
      type: "DISPUTE",
      title: "Disputa de pago urgente",
      message: `Stripe abrió una disputa sobre un ${paymentConcept(context.type).toLowerCase()}. Responder antes de ${formatUnixDate(dispute.evidence_details?.due_by)}.`,
      relatedId: context.id,
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

    return applyFullRefundState(payment.id, "Disputa perdida en Stripe");
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
  queueTask(tasks, "dispute closed admin notification failed", async () => {
    await NotificationService.notifyAllAdmins({
      type: "DISPUTE",
      title: "Disputa cerrada a favor",
      message: `La disputa ${dispute.id} se cerró a favor del negocio.`,
      relatedId: context.id,
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
