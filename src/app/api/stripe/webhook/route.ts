import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { verifyStripeWebhook } from "@/lib/stripe";
import { db } from "@/lib/db";
import { processStripeEvent } from "@/server/services/stripe-webhook-service";

function parsePayload(rawBody: string) {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as Prisma.PrismaClientKnownRequestError).code === "P2002"
  );
}

export async function POST(req: Request) {
  const sig = (await headers()).get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { ok: false, error: { code: "NO_SIGNATURE", message: "Missing signature" } },
      { status: 400 }
    );
  }

  const rawBody = await req.text();

  let event;
  try {
    event = verifyStripeWebhook(rawBody, sig);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_SIGNATURE", message: err.message } },
      { status: 400 }
    );
  }

  try {
    let webhookEvent = await db.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
      select: { processedAt: true },
    });

    if (webhookEvent?.processedAt) {
      return NextResponse.json({ ok: true, deduplicated: true });
    }

    if (!webhookEvent) {
      try {
        await db.webhookEvent.create({
          data: {
            stripeEventId: event.id,
            type: event.type,
            payload: parsePayload(rawBody),
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      }

      webhookEvent = await db.webhookEvent.findUnique({
        where: { stripeEventId: event.id },
        select: { processedAt: true },
      });

      if (webhookEvent?.processedAt) {
        return NextResponse.json({ ok: true, deduplicated: true });
      }
    }

    const deferredTasks = await processStripeEvent(event);

    // Complete the durable side effects (notably NotificationDelivery upserts)
    // before marking the Stripe event processed. Every task isolates its own
    // failure, so an email/outbox issue never reverts a payment; if the
    // process dies first, Stripe can retry and recipient-scoped dedupe keeps
    // the event idempotent.
    await Promise.allSettled(deferredTasks.map((task) => task()));

    await db.webhookEvent.update({
      where: { stripeEventId: event.id },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: { code: "WEBHOOK_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
