/**
 * GET /api/student/my-courses
 * List the caller's accessible courses for the chat sidebar. Admins see all
 * published courses (mirrors the admin bypass in
 * api/chat/rooms/[courseId]/route.ts:45-59); students see only courses with
 * an active CourseAccess record. Never accepts a userId param — the caller
 * is always resolved from the session, never from the request.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { buildActiveCourseAccessWhere } from '@/lib/course-access'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Debes iniciar sesión' },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.role === 'ADMIN') {
      const courses = await db.course.findMany({
        where: { isActive: true },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      })
      return NextResponse.json({ success: true, data: courses })
    }

    const accesses = await db.courseAccess.findMany({
      where: { userId: user.id, ...buildActiveCourseAccessWhere() },
      select: { course: { select: { id: true, title: true } } },
    })

    const courses = accesses
      .map((a) => a.course)
      .sort((a, b) => a.title.localeCompare(b.title))

    return NextResponse.json({ success: true, data: courses })
  } catch (error) {
    console.error('Error listing student courses:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list courses' },
      { status: 500 }
    )
  }
}
