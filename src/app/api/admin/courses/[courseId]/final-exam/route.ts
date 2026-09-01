import { NextResponse } from 'next/server'
import { FinalExamQuestionType } from '@prisma/client'
import { z } from 'zod'
import { getAdminUser } from '@/lib/admin-access'
import { AcademyAssessmentError, getAdminFinalExam, upsertFinalExam } from '@/server/services/academy-assessment-service'

const FinalQuestionSchema = z.object({
  type: z.nativeEnum(FinalExamQuestionType),
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  required: z.boolean().optional().default(true),
  // Only meaningful for MULTIPLE_CHOICE; the service validates the pairing and
  // clears both fields for the manually graded types.
  options: z.array(z.string().trim().min(1)).optional().nullable(),
  correctAnswer: z.string().trim().min(1).optional().nullable(),
  config: z.any().optional().nullable(),
})

const FinalExamSchema = z.object({
  title: z.string().trim().min(1).default('Examen final'),
  description: z.string().trim().optional().nullable(),
  maxAttempts: z.number().int().min(1).max(50).default(1),
  questions: z.array(FinalQuestionSchema).optional(),
})

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ success: false, error: 'Acceso de administración requerido.' }, { status: 403 })
    const { courseId } = await params
    return NextResponse.json({ success: true, data: await getAdminFinalExam(courseId) })
  } catch (error) {
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    console.error('Error fetching final exam:', error)
    return NextResponse.json({ success: false, error: 'No fue posible cargar el examen final.' }, { status: 500 })
  }
}

async function saveFinalExam(request: Request, courseId: string) {
  const input = FinalExamSchema.parse(await request.json())
  return upsertFinalExam(courseId, input)
}

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ success: false, error: 'Acceso de administración requerido.' }, { status: 403 })
    const { courseId } = await params
    return NextResponse.json({ success: true, data: await saveFinalExam(request, courseId) }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'La configuración del examen no es válida.', details: error.issues }, { status: 400 })
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    console.error('Error creating final exam:', error)
    return NextResponse.json({ success: false, error: 'No fue posible guardar el examen final.' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ success: false, error: 'Acceso de administración requerido.' }, { status: 403 })
    const { courseId } = await params
    return NextResponse.json({ success: true, data: await saveFinalExam(request, courseId) })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'La configuración del examen no es válida.', details: error.issues }, { status: 400 })
    if (error instanceof AcademyAssessmentError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    console.error('Error updating final exam:', error)
    return NextResponse.json({ success: false, error: 'No fue posible guardar el examen final.' }, { status: 500 })
  }
}
