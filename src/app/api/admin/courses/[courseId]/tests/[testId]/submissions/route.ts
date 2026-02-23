import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'

async function requireAdmin() {
  const session = await getServerSession()
  if (!session?.user?.email) return null
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { courseId, testId } = await params

    const test = await db.courseTest.findUnique({ where: { id: testId }, select: { courseId: true } })
    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const url = new URL(req.url)
    const status = url.searchParams.get('status') || undefined

    const submissions = await db.courseTestSubmission.findMany({
      where: {
        courseTestId: testId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        answers: {
          include: {
            question: { select: { id: true, title: true, type: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: submissions })
  } catch (error) {
    console.error('Error fetching submissions:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch submissions' }, { status: 500 })
  }
}
