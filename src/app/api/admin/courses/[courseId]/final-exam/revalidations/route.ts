import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/admin-access'
import { AcademyAssessmentError, grantFinalExamRevalidation } from '@/server/services/academy-assessment-service'

const RevalidationSchema = z.object({
  userId: z.string().min(1),
  attemptsGranted: z.number().int().min(1).max(50).default(1),
  reason: z.string().trim().max(2000).optional().nullable(),
})

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ success: false, error: 'Acceso de administración requerido.' }, { status: 403 })
    const { courseId } = await params
    const input = RevalidationSchema.parse(await request.json())
    const data = await grantFinalExamRevalidation(admin.id, courseId, input.userId, input.attemptsGranted, input.reason)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'La revalidación no es válida.', details: error.issues }, { status: 400 })
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    console.error('Error granting final exam revalidation:', error)
    return NextResponse.json({ success: false, error: 'No fue posible habilitar el nuevo intento.' }, { status: 500 })
  }
}
