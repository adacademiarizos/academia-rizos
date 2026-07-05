import { db } from "@/lib/db";
import { sendPaymentReceiptEmail } from "@/lib/mail";

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
      stripePaymentIntentId: true,
    },
  });

  let processed = 0;
  const errors: string[] = [];

  for (const payment of pendingReceipts) {
    if (!payment.payerEmail) {
      continue;
    }

    try {
      await sendPaymentReceiptEmail({
        to: payment.payerEmail,
        paymentId: payment.id,
        amountCents: payment.amountCents,
        currency: payment.currency,
        concept: resolvePaymentConcept(payment.type),
        stripePaymentIntentId: payment.stripePaymentIntentId ?? undefined,
      });

      await db.payment.update({
        where: { id: payment.id },
        data: {
          receiptEmailSentAt: new Date(),
          receiptToEmail: payment.payerEmail,
        },
      });

      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Failed to send receipt for payment ${payment.id}: ${message}`);
    }
  }

  return { processed, errors };
}
