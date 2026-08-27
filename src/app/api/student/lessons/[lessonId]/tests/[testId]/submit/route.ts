import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'
import { AcademyAssessmentError, submitLessonTest } from '@/server/services/academy-assessment-service'

const SubmitLessonTestSchema = z.object({ answers: z.record(z.string(), z.string()) })

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string; testId: string }> }) {
  try {
    const { lessonId, testId } = await params
    const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } })
    if (!lesson) return NextResponse.json({ success: false, error: 'La lección no existe.' }, { status: 404 })
    const access = await authorizeCourseAccessByCourseId(lesson.module.courseId, { requireActiveAccess: true })
    if (!access.ok) return toAccessDeniedResponse(access)
    const body = SubmitLessonTestSchema.parse(await request.json())
    const data = await submitLessonTest(access.user.id, lessonId, testId, body.answers)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Las respuestas no son válidas.', details: error.issues }, { status: 400 })
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code, details: error.details }, { status: error.status })
    console.error('Error submitting lesson test:', error)
    return NextResponse.json({ success: false, error: 'No fue posible enviar el test.' }, { status: 500 })
  }
}
