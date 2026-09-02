import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-access'
import { getCourseProgressAnalytics } from '@/server/services/course-progress-analytics-service'

/**
 * GET /api/admin/courses/[courseId]/analytics
 *
 * Progress-only per-course analytics (D-05/D-11). No query parameters — all
 * metrics are lifetime and unwindowed. Response envelope is `{ success, data }`
 * to match the rest of `/api/admin/courses/**`, not the `{ ok, data }` shape
 * used by `/api/admin/analytics/*`.
 */
export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ success: false, error: 'Acceso de administración requerido.' }, { status: 403 })
    const { courseId } = await params
    const data = await getCourseProgressAnalytics(courseId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error loading course progress analytics:', error)
    return NextResponse.json({ success: false, error: 'No fue posible cargar las analíticas del curso.' }, { status: 500 })
  }
}
