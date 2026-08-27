import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/admin-access'
import { AcademyAssessmentError, deleteLessonTest, upsertLessonTest } from '@/server/services/academy-assessment-service'

const QuestionSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  options: z.array(z.string().trim().min(1)).min(2),
  correctAnswer: z.string().trim().min(1),
}).refine((question) => question.options.includes(question.correctAnswer), {
  message: 'La respuesta correcta debe ser una de las opciones.',
  path: ['correctAnswer'],
})

const LessonTestSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  maxAttempts: z.number().int().min(1).max(50),
  passingScore: z.number().int().min(0).max(100),
  questions: z.array(QuestionSchema).optional(),
})

export async function PUT(request: Request, { params }: { params: Promise<{ lessonId: string; testId: string }> }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ success: false, error: 'Acceso de administración requerido.' }, { status: 403 })
    const { lessonId, testId } = await params
    const input = LessonTestSchema.parse(await request.json())
    const test = await upsertLessonTest(lessonId, { ...input, id: testId })
    return NextResponse.json({ success: true, data: test })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'La configuración del test no es válida.', details: error.issues }, { status: 400 })
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    console.error('Error updating lesson test:', error)
    return NextResponse.json({ success: false, error: 'No fue posible actualizar el test.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ lessonId: string; testId: string }> }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ success: false, error: 'Acceso de administración requerido.' }, { status: 403 })
    const { lessonId, testId } = await params
    await deleteLessonTest(lessonId, testId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    console.error('Error deleting lesson test:', error)
    return NextResponse.json({ success: false, error: 'No fue posible eliminar el test.' }, { status: 500 })
  }
}
