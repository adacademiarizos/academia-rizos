import { getSafeNotificationActionUrl } from '@/app/components/notification-action-url'

describe('getSafeNotificationActionUrl', () => {
  it.each([
    ['/admin/appointments?tab=pending', '/admin/appointments?tab=pending'],
    ['/learn/course-1#module-2', '/learn/course-1#module-2'],
    [' /staff/payment-links ', '/staff/payment-links'],
  ])('keeps an internal route navigable', (actionUrl, expected) => {
    expect(getSafeNotificationActionUrl(actionUrl)).toBe(expected)
  })

  it.each([
    undefined,
    null,
    '',
    'https://example.com/redirect',
    '//example.com/redirect',
    '/\\example.com/redirect',
    'javascript:alert(1)',
  ])('rejects unsafe or missing action URLs', (actionUrl) => {
    expect(getSafeNotificationActionUrl(actionUrl)).toBeNull()
  })
})
