import { NextResponse } from 'next/server'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { AcademyAssessmentError, getStudentFinalExam } from '@/server/services/academy-assessment-service'

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params
    const access = await authorizeCourseAccessByCourseId(courseId, { requireActiveAccess: true })
    if (!access.ok) return toAccessDeniedResponse(access)
    return NextResponse.json({ success: true, data: await getStudentFinalExam(access.user.id, courseId) })
  } catch (error) {
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    console.error('Error fetching student final exam:', error)
    return NextResponse.json({ success: false, error: 'No fue posible cargar el examen final.' }, { status: 500 })
  }
}
