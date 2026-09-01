import { db } from '@/lib/db'
import { CourseService } from '@/server/services/course-service'
import { StripePaymentConfirmationService } from '@/server/services/stripe-payment-confirmation-service'

jest.mock('@/lib/db', () => ({ db: { $transaction: jest.fn() } }))
jest.mock('@/server/services/course-service', () => ({
  CourseService: { createCourseAccess: jest.fn() },
}))

const transaction = {
  payment: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  conversionEvent: {
    upsert: jest.fn(),
  },
}

const checkout = {
  type: 'COURSE' as const,
  stripeCheckoutSessionId: 'cs_replay_safe',
  stripePaymentIntentId: 'pi_replay_safe',
  amountCents: 4900,
  currency: 'EUR',
  payerEmail: 'student@example.com',
  metadata: {
    userId: 'student-1',
    courseId: 'course-1',
    analyticsSessionId: 'analytics-1',
  },
}

describe('StripePaymentConfirmationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(db.$transaction as jest.Mock).mockImplementation((callback) => callback(transaction))
    ;(transaction.payment.upsert as jest.Mock).mockResolvedValue({
      id: 'payment-1',
      type: 'COURSE',
      courseId: 'course-1',
      payerId: 'student-1',
      appointmentId: null,
      paymentLinkId: null,
      amountCents: 4900,
      currency: 'EUR',
      receiptEmailSentAt: null,
    })
    ;(transaction.conversionEvent.upsert as jest.Mock).mockResolvedValue({ id: 'conversion-1' })
    ;(CourseService.createCourseAccess as jest.Mock).mockResolvedValue({ id: 'access-1' })
  })

  it('grants access only for the first confirmed checkout while each delivery upserts its attributed conversion', async () => {
    ;(transaction.payment.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 'PAID', paidAt: new Date('2026-03-01T12:00:00.000Z') })

    const first = await StripePaymentConfirmationService.confirm(checkout)
    const replay = await StripePaymentConfirmationService.confirm(checkout)

    expect(first.isFirstConfirmation).toBe(true)
    expect(replay.isFirstConfirmation).toBe(false)
    expect(CourseService.createCourseAccess).toHaveBeenCalledTimes(1)
    expect(CourseService.createCourseAccess).toHaveBeenCalledWith('student-1', 'course-1', transaction)
    expect(transaction.conversionEvent.upsert).toHaveBeenCalledTimes(2)
    expect(transaction.conversionEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { paymentId: 'payment-1' },
    }))
  })
})
