import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    // /api/pay/:id/checkout
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[2];

    if (!id) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_ID", message: "Missing payment link id in URL" } },
        { status: 400 }
      );
    }

    const link = await db.paymentLink.findUnique({ where: { id } });

    if (!link) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Payment link not found" } },
        { status: 404 }
      );
    }

    if (link.status === "PAID") {
      return NextResponse.json(
        { ok: false, error: { code: "ALREADY_PAID", message: "Payment link already paid" } },
        { status: 400 }
      );
    }

    // ✅ FORZAR localhost en dev SIEMPRE
    const baseUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

          console.log("Creating checkout session for payment link", { linkId: link.id, baseUrl });

    const currency = (link.currency || "EUR").toLowerCase();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/pay/${link.id}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pay/${link.id}?canceled=1`,
      customer_email: link.customerEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: link.totalAmountCents,
            product_data: {
              name: link.title,
              description: link.description || undefined,
            },
          },
        },
      ],
      metadata: {
        type: "PAYMENT_LINK",
        paymentLinkId: link.id,
        baseAmountCents: String(link.baseAmountCents),
        totalAmountCents: String(link.totalAmountCents),
        currency: link.currency,
      },
    });

    if (!session.url) {
      console.error("Stripe session created but missing URL", { sessionId: session.id });
      return NextResponse.json(
        { ok: false, error: { code: "NO_URL", message: "Stripe session URL missing" } },
        { status: 500 }
      );
    }

    await db.paymentLink.update({
      where: { id: link.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    await db.payment.create({
      data: {
        type: "PAYMENT_LINK",
        status: "PROCESSING",
        amountCents: link.totalAmountCents,
        currency: link.currency,
        stripeCheckoutSessionId: session.id,
        paymentLinkId: link.id,
        payerEmail: link.customerEmail || null,
        metadata: session.metadata as any,
      },
    });

    return NextResponse.redirect(session.url,303);
  } catch (err: any) {
    console.error("PAY CHECKOUT ERROR", err?.message, err);
    return NextResponse.json(
      { ok: false, error: { code: "CHECKOUT_ERROR", message: err?.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}
