import { NextResponse } from 'next/server'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'
import { AcademyAssessmentError, markLessonComplete } from '@/server/services/academy-assessment-service'

export async function POST(_: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const { lessonId } = await params
    const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { courseId: true } })
    if (!lesson) return NextResponse.json({ success: false, error: 'La lección no existe.' }, { status: 404 })

    const access = await authorizeCourseAccessByCourseId(lesson.courseId, { requireActiveAccess: true })
    if (!access.ok) return toAccessDeniedResponse(access)

    const result = await markLessonComplete(access.user.id, lessonId)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof AcademyAssessmentError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code, details: error.details }, { status: error.status })
    }
    console.error('Error completing lesson:', error)
    return NextResponse.json({ success: false, error: 'No fue posible completar la lección.' }, { status: 500 })
  }
}
