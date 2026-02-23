import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { db } from '@/lib/db'

const ReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REVISION_REQUESTED']),
  isPassed: z.boolean().optional(),
})

async function requireAdmin() {
  const session = await getServerSession()
  if (!session?.user?.email) return null
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string; submissionId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { courseId, testId, submissionId } = await params

    const test = await db.courseTest.findUnique({ where: { id: testId }, select: { courseId: true } })
    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const existing = await db.courseTestSubmission.findUnique({ where: { id: submissionId } })
    if (!existing || existing.courseTestId !== testId) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = ReviewSchema.parse(body)

    const submission = await db.courseTestSubmission.update({
      where: { id: submissionId },
      data: {
        status: data.status,
        isPassed: data.isPassed ?? (data.status === 'APPROVED'),
      },
    })

    return NextResponse.json({ success: true, data: submission })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to review submission' }, { status: 500 })
  }
}
