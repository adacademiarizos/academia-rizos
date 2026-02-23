import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { addStripeFees } from "@/lib/fees";
import { checkStaffAuth } from "@/lib/staff-auth";

export async function GET(req: Request) {
  const auth = await checkStaffAuth();
  if (!auth.authorized) return auth.response;

  const links = await db.paymentLink.findMany({
    where: { createdById: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json({ ok: true, data: links });
}

export async function POST(req: Request) {
  const auth = await checkStaffAuth();
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const { title, description, customerEmail, baseAmount } = body;

  if (!title || !baseAmount || Number(baseAmount) <= 0) {
    return NextResponse.json(
      { ok: false, error: "Faltan campos requeridos" },
      { status: 400 }
    );
  }

  const settings = await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });

  const currency = "EUR";
  const baseAmountCents = Math.round(Number(baseAmount) * 100);
  const { totalCents } = addStripeFees({
    baseCents: baseAmountCents,
    feePercent: settings.feePercent,
    feeFixedCents: settings.feeFixedCents,
  });

  const link = await db.paymentLink.create({
    data: {
      title,
      description: description || null,
      customerEmail: customerEmail || null,
      currency,
      baseAmountCents,
      totalAmountCents: totalCents,
      status: "REQUIRES_PAYMENT",
      createdById: auth.user.id,
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${env.NEXT_PUBLIC_APP_URL}/pay/${link.id}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pay/${link.id}?canceled=1`,
    customer_email: customerEmail || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: totalCents,
          product_data: {
            name: title,
            description: description || undefined,
          },
        },
      },
    ],
    metadata: {
      type: "PAYMENT_LINK",
      paymentLinkId: link.id,
      baseAmountCents: String(baseAmountCents),
      totalAmountCents: String(totalCents),
      currency,
    },
  });

  await db.paymentLink.update({
    where: { id: link.id },
    data: { stripeCheckoutSessionId: session.id },
  });

  await db.payment.create({
    data: {
      type: "PAYMENT_LINK",
      status: "PROCESSING",
      amountCents: totalCents,
      currency,
      stripeCheckoutSessionId: session.id,
      paymentLinkId: link.id,
      payerEmail: customerEmail || null,
      metadata: session.metadata as any,
    },
  });

  return NextResponse.json({ ok: true, data: link, checkoutUrl: session.url });
}
