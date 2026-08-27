import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { grantAssessmentRevalidation } from '@/server/services/learning-content-service'
import { getAssessmentScope, learningErrorResponse, requireAdminForScope } from '@/lib/learning-api'

const revalidationSchema = z.object({
  userId: z.string().min(1),
  attemptsGranted: z.number().int().min(1).max(100),
  reason: z.string().trim().max(5000).optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await params
    const access = await requireAdminForScope(await getAssessmentScope(assessmentId))
    if ('error' in access) return access.error
    const input = revalidationSchema.parse(await request.json())
    const grant = await grantAssessmentRevalidation(access.userId, assessmentId, input.userId, input)
    return NextResponse.json({ success: true, data: grant }, { status: 201 })
  } catch (error) {
    return learningErrorResponse(error)
  }
}
