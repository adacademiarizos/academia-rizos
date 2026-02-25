import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { db } from '@/lib/db'
import { generateAndSaveCertificate } from '@/server/services/certificate.service'
import { NotificationService } from '@/server/services/notification-service'

const ReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REVISION_REQUESTED']),
  reviewNote: z.string().optional(),
})

async function requireAdmin() {
  const session = await getServerSession()
  if (!session?.user?.email) return null
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; submissionId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { courseId, submissionId } = await params

    // Verify exam belongs to this course
    const exam = await db.courseExam.findUnique({
      where: { courseId },
      select: { id: true },
    })
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 })
    }

    const existing = await db.examSubmission.findUnique({ where: { id: submissionId } })
    if (!existing || existing.examId !== exam.id) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = ReviewSchema.parse(body)

    const submission = await db.examSubmission.update({
      where: { id: submissionId },
      data: {
        status: data.status,
        reviewNote: data.reviewNote ?? null,
        reviewedAt: new Date(),
      },
    })

    // Trigger certificate generation on approval
    if (data.status === 'APPROVED') {
      await generateAndSaveCertificate(existing.userId, courseId)
    }

    // Notify student of review result
    await NotificationService.triggerOnExamReview(
      existing.userId,
      courseId,
      data.status,
      data.reviewNote
    )

    return NextResponse.json({ success: true, data: submission })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors }, { status: 400 })
    }
    console.error('Error reviewing submission:', error)
    const message = error instanceof Error ? error.message : 'Failed to review submission'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
