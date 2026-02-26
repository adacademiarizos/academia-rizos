import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type Body = {
  type: "APPOINTMENT";
  appointmentId: string;
};

function getBaseUrl(req: Request): string {
  // 1. Explicit env var always wins (set this in your hosting dashboard)
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  // 2. Derive from the actual incoming request — always correct in production
  const { protocol, host } = new URL(req.url);
  return `${protocol}//${host}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.appointmentId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "appointmentId is required" } },
        { status: 400 }
      );
    }

    const appointment = await db.appointment.findUnique({
      where: { id: body.appointmentId },
      include: {
        service: true,
        staff: true,
        customer: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    // precio real según service+staff
    const price = await db.serviceStaffPrice.findUnique({
      where: { serviceId_staffId: { serviceId: appointment.serviceId, staffId: appointment.staffId } },
    });

    if (!price) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_PRICE", message: "No price configured for this service/staff" } },
        { status: 400 }
      );
    }

    const billingRule = appointment.service.billingRule; // FULL | DEPOSIT | AUTHORIZE
    if (billingRule === "AUTHORIZE") {
      return NextResponse.json(
        { ok: false, error: { code: "NO_CHARGE", message: "This appointment requires authorization (no charge yet)" } },
        { status: 400 }
      );
    }

    const baseAmount = price.priceCents;

    // depósito si aplica
    let chargeAmount = baseAmount;
    if (billingRule === "DEPOSIT") {
      const pct = appointment.service.depositPct ?? 50;
      chargeAmount = Math.round((baseAmount * pct) / 100);
    }

    // Stripe mínimo (usd/eur) suele ser 50 cents.
    if (chargeAmount < 50) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "AMOUNT_TOO_SMALL",
            message: `Charge amount too small: ${chargeAmount} cents. Check priceCents/depositPct.`,
          },
        },
        { status: 400 }
      );
    }

    const currency = (price.currency || "EUR").toLowerCase();
    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/booking?canceled=1`,
      customer_email: appointment.customer?.email ?? appointment.customerEmail ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: chargeAmount,
            product_data: {
              name: `Cita: ${appointment.service.name}`,
              description: `Profesional: ${appointment.staff.name ?? appointment.staff.email}`,
            },
          },
        },
      ],
      metadata: {
        type: "APPOINTMENT",
        appointmentId: appointment.id,
        serviceId: appointment.serviceId,
        staffId: appointment.staffId,
        billingRule,
        baseAmountCents: String(baseAmount),
        chargeAmountCents: String(chargeAmount),
        currency: price.currency,
      },
    });

    // registrar pago en DB
    await db.payment.create({
      data: {
        type: "APPOINTMENT",
        status: "PROCESSING",
        amountCents: chargeAmount,
        currency: price.currency,
        stripeCheckoutSessionId: session.id,
        appointmentId: appointment.id,
        payerEmail: appointment.customer?.email ?? appointment.customerEmail ?? undefined,
        payerId: appointment.customerId,
        metadata: session.metadata as any,
      },
    });

    return NextResponse.json({ ok: true, data: { checkoutUrl: session.url } });
  } catch (err: any) {
    console.error("CHECKOUT ERROR:", err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: { code: "CHECKOUT_ERROR", message: err?.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}
