import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { AcademyAssessmentError, submitFinalExam } from '@/server/services/academy-assessment-service'

const SubmitFinalExamSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1),
    responseText: z.string().optional().nullable(),
    fileUrl: z.string().url().optional().nullable(),
    fileMimeType: z.string().max(255).optional().nullable(),
  })),
})

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params
    const access = await authorizeCourseAccessByCourseId(courseId, { requireActiveAccess: true })
    if (!access.ok) return toAccessDeniedResponse(access)
    const input = SubmitFinalExamSchema.parse(await request.json())
    const data = await submitFinalExam(access.user.id, courseId, input.answers)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Las respuestas no son válidas.', details: error.issues }, { status: 400 })
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code, details: error.details }, { status: error.status })
    console.error('Error submitting final exam:', error)
    return NextResponse.json({ success: false, error: 'No fue posible enviar el examen final.' }, { status: 500 })
  }
}
