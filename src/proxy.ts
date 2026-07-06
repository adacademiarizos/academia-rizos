import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getProtectedRouteDecision } from '@/lib/route-guard'

export default async function handler(req: NextRequest) {
  const { pathname } = req.nextUrl

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const role = (token as { role?: string } | null)?.role ?? null
  const decision = getProtectedRouteDecision(pathname, !!token, role)

  if (!decision.allow) {
    const url = req.nextUrl.clone()
    url.pathname = '/access-denied'
    url.searchParams.set('reason', decision.reason)
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/staff/:path*',
    '/student',
    '/notifications',
    '/bug-report',
    '/bug-report/:path*',
    '/learn/:path*',
  ],
}
