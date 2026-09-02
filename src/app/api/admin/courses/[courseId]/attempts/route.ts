import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/admin-access'
import { AcademyAssessmentError } from '@/server/services/academy-assessment-service'
import { listBlockedStudentsForTarget } from '@/server/services/course-attempts-service'

const QuerySchema = z.object({
  system: z.enum(['ASSESSMENT', 'LESSON_TEST', 'FINAL_EXAM']),
  targetId: z.string().min(1),
})

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ success: false, error: 'Acceso de administración requerido.' }, { status: 403 })
    // `courseId` always comes from the route param, never from the query
    // string — it is the authorization scope, not a client-supplied filter.
    const { courseId } = await params
    const { searchParams } = new URL(request.url)
    const input = QuerySchema.parse({
      system: searchParams.get('system'),
      targetId: searchParams.get('targetId'),
    })
    const data = await listBlockedStudentsForTarget(courseId, input.system, input.targetId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Parámetros inválidos.', details: error.issues }, { status: 400 })
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    console.error('Error listing blocked students for target:', error)
    return NextResponse.json({ success: false, error: 'No fue posible cargar los intentos bloqueados.' }, { status: 500 })
  }
}
