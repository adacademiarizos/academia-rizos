import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-access'
import { listCourseAttemptTargets } from '@/server/services/course-attempts-service'

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ success: false, error: 'Acceso de administración requerido.' }, { status: 403 })
    const { courseId } = await params
    const data = await listCourseAttemptTargets(courseId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error listing course attempt targets:', error)
    return NextResponse.json({ success: false, error: 'No fue posible cargar los tests del curso.' }, { status: 500 })
  }
}
