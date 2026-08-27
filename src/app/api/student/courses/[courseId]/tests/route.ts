import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { isCourseAccessActive } from '@/lib/course-access'

async function requireStudent(courseId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } })
  if (!user) return null

  // Check course access
  const access = await db.courseAccess.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { accessUntil: true, revokedAt: true },
  })
  if (!isCourseAccessActive(access)) return null

  return user
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const user = await requireStudent(courseId)
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const tests = await db.courseTest.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        order: true,
        isRequired: true,
        isFinalExam: true,
        maxAttempts: true,
        passingScore: true,
        _count: { select: { questions: true } },
      },
    })

    return NextResponse.json({ success: true, data: tests })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch tests' }, { status: 500 })
  }
}
