import { db } from '@/lib/db'
import { CourseService } from '@/server/services/course-service'

type CheckoutPaymentType = 'APPOINTMENT' | 'COURSE' | 'PAYMENT_LINK'

export type CheckoutPaymentConfirmationInput = {
  type?: CheckoutPaymentType
  stripeCheckoutSessionId: string
  stripePaymentIntentId?: string
  amountCents: number
  currency: string
  payerEmail?: string
  metadata: Record<string, string>
}

function paymentTypeFromCheckout(type?: CheckoutPaymentType): CheckoutPaymentType {
  return type ?? 'PAYMENT_LINK'
}

export class StripePaymentConfirmationService {
  static async confirm(input: CheckoutPaymentConfirmationInput) {
    return db.$transaction(async (transaction) => {
      const existingPayment = await transaction.payment.findUnique({
        where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
        select: { status: true, paidAt: true },
      })
      const isFirstConfirmation = existingPayment?.status !== 'PAID'

      const payment = await transaction.payment.upsert({
        where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
        create: {
          type: paymentTypeFromCheckout(input.type),
          status: 'PAID',
          amountCents: input.amountCents,
          currency: input.currency,
          stripeCheckoutSessionId: input.stripeCheckoutSessionId,
          stripePaymentIntentId: input.stripePaymentIntentId,
          appointmentId: input.metadata.appointmentId ?? null,
          courseId: input.metadata.courseId ?? null,
          paymentLinkId: input.metadata.paymentLinkId ?? null,
          payerId: input.metadata.userId ?? null,
          payerEmail: input.payerEmail,
          paidAt: new Date(),
          metadata: input.metadata,
        },
        update: {
          status: 'PAID',
          amountCents: input.amountCents,
          currency: input.currency,
          stripePaymentIntentId: input.stripePaymentIntentId,
          payerId: input.metadata.userId ?? undefined,
          payerEmail: input.payerEmail ?? undefined,
          paidAt: existingPayment?.paidAt ?? new Date(),
          metadata: input.metadata,
        },
      })

      await transaction.conversionEvent.upsert({
        where: { paymentId: payment.id },
        update: {},
        create: {
          paymentId: payment.id,
          type: payment.type === 'APPOINTMENT' ? 'BOOKING' : payment.type === 'COURSE' ? 'COURSE_PURCHASE' : 'PAYMENT_LINK',
          sessionId: input.metadata.analyticsSessionId || 'unknown',
          userId: input.metadata.userId || payment.payerId || null,
          referrer: input.metadata.analyticsReferrer || null,
          utmSource: input.metadata.utmSource || null,
          utmMedium: input.metadata.utmMedium || null,
          utmCampaign: input.metadata.utmCampaign || null,
          amountCents: payment.amountCents,
          currency: payment.currency,
          metadata: {
            paymentId: payment.id,
            appointmentId: payment.appointmentId,
            courseId: payment.courseId,
            paymentLinkId: payment.paymentLinkId,
          },
        },
      })

      // A failed course grant rolls this transaction back. Stripe can safely
      // redeliver the event instead of leaving a paid learner without access.
      if (isFirstConfirmation && payment.type === 'COURSE' && payment.courseId && payment.payerId) {
        await CourseService.createCourseAccess(payment.payerId, payment.courseId, transaction)
      }

      return { payment, isFirstConfirmation }
    })
  }
}
