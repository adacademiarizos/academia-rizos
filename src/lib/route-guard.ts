export type RouteGuardReason =
  | 'SIGN_IN_REQUIRED'
  | 'ADMIN_ROLE_REQUIRED'
  | 'STAFF_ROLE_REQUIRED'
  | 'STUDENT_DASHBOARD_UNAVAILABLE'

export type RouteGuardDecision =
  | { allow: true }
  | { allow: false; reason: RouteGuardReason }

export function getProtectedRouteDecision(
  pathname: string,
  isAuthenticated: boolean,
  role?: string | null
): RouteGuardDecision {
  const isAdminRoute = pathname.startsWith('/admin')
  const isStaffRoute = pathname.startsWith('/staff')
  const isStudentRoute = pathname === '/student' || pathname.startsWith('/student/')
  const isNotificationsRoute = pathname === '/notifications'
  const isBugReportRoute = pathname.startsWith('/bug-report')
  const isLearnRoute = pathname.startsWith('/learn/')

  const isProtectedRoute =
    isAdminRoute ||
    isStaffRoute ||
    isStudentRoute ||
    isNotificationsRoute ||
    isBugReportRoute ||
    isLearnRoute

  if (!isProtectedRoute) {
    return { allow: true }
  }

  if (!isAuthenticated) {
    return { allow: false, reason: 'SIGN_IN_REQUIRED' }
  }

  if (isAdminRoute && role !== 'ADMIN') {
    return { allow: false, reason: 'ADMIN_ROLE_REQUIRED' }
  }

  if (isStaffRoute && role !== 'STAFF' && role !== 'ADMIN') {
    return { allow: false, reason: 'STAFF_ROLE_REQUIRED' }
  }

  if (isStudentRoute && (role === 'ADMIN' || role === 'STAFF')) {
    return { allow: false, reason: 'STUDENT_DASHBOARD_UNAVAILABLE' }
  }

  return { allow: true }
}
