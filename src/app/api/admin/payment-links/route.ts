import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { addStripeFees } from "@/lib/fees";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function POST(req: Request) {
  // Check authentication
  const auth = await checkAdminAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const form = await req.formData();

  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const customerEmail = String(form.get("customerEmail") ?? "").trim();
  const baseAmount = Number(form.get("baseAmount") ?? 0); // en unidades (ej 10.00)
  const currency = String(form.get("currency") ?? "EUR").toUpperCase();

  if (!title || !baseAmount || baseAmount <= 0) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_INPUT", message: "Missing fields" } },
      { status: 400 }
    );
  }

  const settings = await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });

  const baseAmountCents = Math.round(baseAmount * 100);

  const { totalCents } = addStripeFees({
    baseCents: baseAmountCents,
    feePercent: settings.feePercent,
    feeFixedCents: settings.feeFixedCents,
  });

  // Crear en DB primero (para tener id)
  const link = await db.paymentLink.create({
    data: {
      title,
      description: description || null,
      customerEmail: customerEmail || null,
      currency,
      baseAmountCents,
      totalAmountCents: totalCents,
      status: "REQUIRES_PAYMENT",
    },
  });

  // Crear Checkout Session
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

  // también creamos Payment en PROCESSING (opcional pero recomendable)
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

  return NextResponse.redirect(new URL("/admin/payment-links", req.url));
}
