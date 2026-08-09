import { db } from "@/lib/db";
import { NotificationEventService } from "@/server/services/notification-event-service";

import type { MaintenanceJobResult } from "./types";

function resolvePaymentConcept(type: "APPOINTMENT" | "COURSE" | "PAYMENT_LINK") {
  switch (type) {
    case "APPOINTMENT":
      return "Cita";
    case "COURSE":
      return "Curso";
    default:
      return "Pago";
  }
}

function formatPaymentAmount(amountCents: number, currency: string) {
  return `${(amountCents / 100).toFixed(2)} ${currency}`;
}

function resolveReceiptActionUrl(payment: {
  type: "APPOINTMENT" | "COURSE" | "PAYMENT_LINK";
  courseId: string | null;
  paymentLinkId: string | null;
}) {
  if (payment.type === "COURSE" && payment.courseId) {
    return `/courses/${payment.courseId}`;
  }

  if (payment.type === "PAYMENT_LINK" && payment.paymentLinkId) {
    return `/pay/${payment.paymentLinkId}`;
  }

  return "/booking";
}

export async function sendReceiptJob(): Promise<MaintenanceJobResult> {
  const pendingReceipts = await db.payment.findMany({
    where: {
      status: "PAID",
      receiptEmailSentAt: null,
      payerEmail: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
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

  let processed = 0;
  const errors: string[] = [];

  for (const payment of pendingReceipts) {
    if (!payment.payerEmail) {
      continue;
    }

    try {
      const result = await NotificationEventService.paymentReceipt({
        paymentId: payment.id,
        concept: resolvePaymentConcept(payment.type),
        amountLabel: formatPaymentAmount(payment.amountCents, payment.currency),
        payerEmail: payment.payerEmail,
        actionUrl: resolveReceiptActionUrl(payment),
      });

      if (!result.queued) {
        errors.push(
          `Failed to queue receipt for payment ${payment.id}: ${result.error ?? "Unknown notification queue error"}`,
        );
        continue;
      }

      processed += 1;

      if (!result.markerRecorded) {
        errors.push(
          `Receipt outbox marker was not recorded for payment ${payment.id}: ${result.error ?? "Unknown marker error"}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Failed to queue receipt for payment ${payment.id}: ${message}`);
    }
  }

  return { processed, errors };
}
