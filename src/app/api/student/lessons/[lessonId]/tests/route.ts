import { NextResponse } from 'next/server'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'
import { AcademyAssessmentError, getStudentLessonTests } from '@/server/services/academy-assessment-service'

export async function GET(_: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const { lessonId } = await params
    const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { courseId: true } })
    if (!lesson) return NextResponse.json({ success: false, error: 'La lección no existe.' }, { status: 404 })
    const access = await authorizeCourseAccessByCourseId(lesson.courseId, { requireActiveAccess: true })
    if (!access.ok) return toAccessDeniedResponse(access)
    return NextResponse.json({ success: true, data: await getStudentLessonTests(access.user.id, lessonId) })
  } catch (error) {
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    console.error('Error fetching lesson tests:', error)
    return NextResponse.json({ success: false, error: 'No fue posible cargar los tests.' }, { status: 500 })
  }
}
