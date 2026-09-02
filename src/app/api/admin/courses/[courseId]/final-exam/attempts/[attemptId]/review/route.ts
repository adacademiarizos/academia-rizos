import { NextResponse } from 'next/server'
import { FinalExamAttemptStatus } from '@prisma/client'
import { z } from 'zod'
import { getAdminUser } from '@/lib/admin-access'
import { AcademyAssessmentError, reviewFinalExamAttempt } from '@/server/services/academy-assessment-service'

// Issuing a certificate renders a PDF, and on a cold start that means
// downloading the Chromium pack before the first render. Under the default
// limit the request timed out, the attempt stayed pending, and the reviewer had
// to approve a second time — which worked only because the binary was cached by
// then. The work is the same; it just needs room to finish once.
export const runtime = 'nodejs'
export const maxDuration = 60


const ReviewSchema = z.object({
  status: z.enum([FinalExamAttemptStatus.APPROVED, FinalExamAttemptStatus.NOT_PASSED]),
  reviewNote: z.string().trim().max(2000).optional().nullable(),
})

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string; attemptId: string }> }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ success: false, error: 'Acceso de administración requerido.' }, { status: 403 })
    const { courseId, attemptId } = await params
    const input = ReviewSchema.parse(await request.json())
    const data = await reviewFinalExamAttempt(admin.id, courseId, attemptId, input.status, input.reviewNote)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'La corrección no es válida.', details: error.issues }, { status: 400 })
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    console.error('Error reviewing final exam attempt:', error)
    return NextResponse.json({ success: false, error: 'No fue posible corregir el intento.' }, { status: 500 })
  }
}
