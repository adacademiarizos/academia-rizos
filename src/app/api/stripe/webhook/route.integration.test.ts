/**
 * Integración — POST /api/stripe/webhook
 * Procesamiento de checkout.session.completed contra la DB de test.
 * Cubre el riesgo §8 #2 (idempotencia ante reentregas de Stripe).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

// La firma se verifica con una clave dummy → mockeamos la verificación y
// devolvemos un evento fabricado controlado por cada test.
vi.mock('@/lib/stripe', () => ({
  verifyStripeWebhook: vi.fn(),
  stripe: {},
}))
// El handler lee la cabecera con headers() de next/headers (requiere contexto Next).
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'stripe-signature': 'test-sig' }),
}))
// Sin emails reales.
vi.mock('@/lib/mail', () => ({
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
  sendAppointmentConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendAppointmentNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendAdminAlertEmail: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from './route'
import { verifyStripeWebhook } from '@/lib/stripe'
import { db, resetDb } from '@/test/db-helper'

function makeEvent(sessionOverrides: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        payment_intent: 'pi_test_123',
        amount_total: 5000,
        currency: 'eur',
        customer_details: { email: 'payer@test.local' },
        metadata,
        ...sessionOverrides,
      },
    },
  }
}

function callWebhook() {
  return POST(new Request('http://localhost:3000/api/stripe/webhook', { method: 'POST', body: '{}' }))
}

describe('POST /api/stripe/webhook (integración)', () => {
  beforeEach(async () => {
    await resetDb()
    vi.mocked(verifyStripeWebhook).mockReset()
  })
  afterAll(async () => {
    await db.$disconnect()
  })

  it('devuelve 400 si la firma es inválida', async () => {
    vi.mocked(verifyStripeWebhook).mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const res = await callWebhook()
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_SIGNATURE')
  })

  it('PAYMENT_LINK: registra el Payment como PAID y marca el link como PAID', async () => {
    const link = await db.paymentLink.create({
      data: { title: 'Cobro', baseAmountCents: 5000, totalAmountCents: 5000 },
    })
    vi.mocked(verifyStripeWebhook).mockReturnValue(
      makeEvent({}, { type: 'PAYMENT_LINK', paymentLinkId: link.id, analyticsSessionId: 'sess-1' }) as any
    )

    const res = await callWebhook()
    expect(res.status).toBe(200)

    const payment = await db.payment.findUnique({ where: { stripeCheckoutSessionId: 'cs_test_123' } })
    expect(payment?.status).toBe('PAID')
    expect(payment?.amountCents).toBe(5000)

    const updatedLink = await db.paymentLink.findUnique({ where: { id: link.id } })
    expect(updatedLink?.status).toBe('PAID')
  })

  it('es idempotente para el Payment (upsert por sessionId), pero DUPLICA el ConversionEvent (BUG §8 #2)', async () => {
    const link = await db.paymentLink.create({
      data: { title: 'Cobro', baseAmountCents: 5000, totalAmountCents: 5000 },
    })
    vi.mocked(verifyStripeWebhook).mockReturnValue(
      makeEvent({}, { type: 'PAYMENT_LINK', paymentLinkId: link.id, analyticsSessionId: 'sess-1' }) as any
    )

    await callWebhook() // entrega original
    await callWebhook() // reentrega del mismo evento

    // ✅ El Payment NO se duplica (upsert por stripeCheckoutSessionId)
    const payments = await db.payment.count({ where: { stripeCheckoutSessionId: 'cs_test_123' } })
    expect(payments).toBe(1)

    // ✅ El recibo está protegido por receiptEmailSentAt (no se reenvía)
    const payment = await db.payment.findUnique({ where: { stripeCheckoutSessionId: 'cs_test_123' } })
    expect(payment?.receiptEmailSentAt).not.toBeNull()

    // ❌ BUG §8 #2: el ConversionEvent se crea en CADA reentrega → analytics inflado.
    // Cuando se añada deduplicación por event.id, cambiar a toBe(1).
    const conversions = await db.conversionEvent.count({ where: { sessionId: 'sess-1' } })
    expect(conversions).toBe(2)
  })
})
