import { LearningScope } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'
import { LearningContentError, resolveScopeTarget, type ScopeRef } from '@/server/services/learning-content-service'

export const scopeSchema = z.enum(['COURSE', 'MODULE', 'STYLE', 'LESSON'])

export const resourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  fileUrl: z.string().trim().url().max(4000),
  fileType: z.string().trim().min(1).max(100),
  fileSize: z.number().int().min(0),
  order: z.number().int().min(0).optional(),
})

const questionBaseSchema = z.object({
  type: z.enum(['MULTIPLE_CHOICE', 'WRITTEN', 'PHOTO', 'VIDEO']),
  title: z.string().trim().min(1).max(2000),
  description: z.string().trim().max(5000).optional(),
  order: z.number().int().min(0).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(1000)).min(2).optional(),
  correctAnswer: z.string().trim().min(1).max(1000).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export const assessmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  order: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  isFinalExam: z.boolean().optional(),
  maxAttempts: z.number().int().min(1).max(100).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  published: z.boolean().optional(),
  questions: z.array(questionBaseSchema).min(1).max(100),
}).superRefine((value, context) => {
  value.questions.forEach((question, index) => {
    if (question.type === 'MULTIPLE_CHOICE' && (!question.options?.includes(question.correctAnswer ?? '') || !question.correctAnswer)) {
      context.addIssue({ code: 'custom', path: ['questions', index, 'correctAnswer'], message: 'Selecciona una respuesta correcta de las opciones.' })
    }
  })
})

export const assessmentPatchSchema = assessmentSchema.partial().extend({
  questions: z.array(questionBaseSchema).min(1).max(100).optional(),
})

export const submissionSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1),
    responseText: z.string().max(10000).optional(),
    fileUrl: z.string().url().max(4000).optional(),
    fileMimeType: z.string().max(200).optional(),
  })).min(1).max(100),
})

export function parseScope(scope: string, scopeId: string): ScopeRef {
  const parsed = scopeSchema.safeParse(scope)
  if (!parsed.success || !scopeId) throw new LearningContentError('El contexto solicitado no es válido.', 400, 'INVALID_SCOPE')
  return { scope: parsed.data as LearningScope, scopeId }
}

export async function requireAdminForScope(ref: ScopeRef) {
  const target = await resolveScopeTarget(ref)
  const access = await authorizeCourseAccessByCourseId(target.courseId, { allowAdmin: true, requireActiveAccess: false })
  if (!access.ok) return { error: toAccessDeniedResponse(access) } as const
  if (!access.viaAdmin) return { error: NextResponse.json({ success: false, error: 'Se requieren permisos de administración.' }, { status: 403 }) } as const
  return { target, userId: access.user.id } as const
}

export async function requireStudentForScope(ref: ScopeRef) {
  const target = await resolveScopeTarget(ref)
  const access = await authorizeCourseAccessByCourseId(target.courseId)
  if (!access.ok) return { error: toAccessDeniedResponse(access) } as const
  return { target, userId: access.user.id } as const
}

export async function getAssessmentScope(assessmentId: string) {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, scope: true, courseId: true, moduleId: true, styleId: true, lessonId: true },
  })
  if (!assessment) throw new LearningContentError('La evaluación no existe.', 404, 'ASSESSMENT_NOT_FOUND')
  const scopeId = assessment.courseId ?? assessment.moduleId ?? assessment.styleId ?? assessment.lessonId
  if (!scopeId) throw new LearningContentError('La evaluación no tiene un contexto válido.', 500, 'INVALID_ASSESSMENT_SCOPE')
  return { scope: assessment.scope, scopeId }
}

export function learningErrorResponse(error: unknown) {
  if (error instanceof LearningContentError) {
    return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ success: false, error: 'Los datos enviados no son válidos.', issues: error.issues }, { status: 422 })
  }
  console.error('Learning content API error', error)
  return NextResponse.json({ success: false, error: 'No fue posible completar la operación.' }, { status: 500 })
}
