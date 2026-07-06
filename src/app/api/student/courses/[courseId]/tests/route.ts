import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const access = await authorizeCourseAccessByCourseId(courseId, {
      allowAdmin: true,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

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
