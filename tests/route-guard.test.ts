import { getProtectedRouteDecision } from '@/lib/route-guard'

describe('getProtectedRouteDecision', () => {
  it('denies unauthenticated access to learn routes', () => {
    expect(getProtectedRouteDecision('/learn/course-1', false, null)).toEqual({
      allow: false,
      reason: 'SIGN_IN_REQUIRED',
    })
  })

  it('denies unauthenticated access to admin routes', () => {
    expect(getProtectedRouteDecision('/admin', false, null)).toEqual({
      allow: false,
      reason: 'SIGN_IN_REQUIRED',
    })
  })

  it('requires admin role for admin routes', () => {
    expect(getProtectedRouteDecision('/admin/courses', true, 'STUDENT')).toEqual({
      allow: false,
      reason: 'ADMIN_ROLE_REQUIRED',
    })
  })

  it('requires staff role for staff routes', () => {
    expect(getProtectedRouteDecision('/staff/payment-links', true, 'STUDENT')).toEqual({
      allow: false,
      reason: 'STAFF_ROLE_REQUIRED',
    })
  })

  it('blocks internal roles from student dashboard', () => {
    expect(getProtectedRouteDecision('/student', true, 'STAFF')).toEqual({
      allow: false,
      reason: 'STUDENT_DASHBOARD_UNAVAILABLE',
    })
  })

  it('allows admins into learn routes', () => {
    expect(getProtectedRouteDecision('/learn/course-1/modules/module-1', true, 'ADMIN')).toEqual({
      allow: true,
    })
  })
})
