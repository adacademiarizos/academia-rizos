import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAdminRoute = pathname.startsWith('/admin')
  const isStaffRoute = pathname.startsWith('/staff')
  const isStudentRoute = pathname === '/student' || pathname === '/notifications'
  const isBugReportRoute = pathname.startsWith('/bug-report')

  if (isAdminRoute || isStaffRoute || isStudentRoute || isBugReportRoute) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    })

    // User not authenticated
    if (!token) {
      const url = req.nextUrl.clone()
      url.pathname = '/signin'
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }

    const role = (token as any)?.role

    // Admin routes - only ADMIN role allowed
    if (isAdminRoute && role !== 'ADMIN') {
      const url = req.nextUrl.clone()
      url.pathname = role === 'STAFF' ? '/staff/appointments' : '/student'
      return NextResponse.redirect(url)
    }

    // Staff routes - only STAFF or ADMIN allowed
    if (isStaffRoute && role !== 'STAFF' && role !== 'ADMIN') {
      const url = req.nextUrl.clone()
      url.pathname = '/student'
      return NextResponse.redirect(url)
    }

    // Student routes - redirect ADMIN and STAFF to their dashboards
    if (isStudentRoute && role === 'ADMIN') {
      const url = req.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
    if (isStudentRoute && role === 'STAFF') {
      const url = req.nextUrl.clone()
      url.pathname = '/staff/appointments'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/student', '/notifications', '/bug-report', '/bug-report/:path*'],
}
