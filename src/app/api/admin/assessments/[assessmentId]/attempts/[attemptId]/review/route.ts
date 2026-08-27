import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { reviewAssessmentAttempt } from '@/server/services/learning-content-service'
import { getAssessmentScope, learningErrorResponse, requireAdminForScope } from '@/lib/learning-api'

const reviewSchema = z.object({ approved: z.boolean(), reviewNote: z.string().trim().max(5000).optional() })

export async function POST(request: NextRequest, { params }: { params: Promise<{ assessmentId: string; attemptId: string }> }) {
  try {
    const { assessmentId, attemptId } = await params
    const access = await requireAdminForScope(await getAssessmentScope(assessmentId))
    if ('error' in access) return access.error
    const ownedAttempt = await db.assessmentAttempt.findFirst({ where: { id: attemptId, assessmentId }, select: { id: true } })
    if (!ownedAttempt) return NextResponse.json({ success: false, error: 'El intento no pertenece a esta evaluación.' }, { status: 404 })
    const attempt = await reviewAssessmentAttempt(access.userId, attemptId, reviewSchema.parse(await request.json()))
    return NextResponse.json({ success: true, data: attempt })
  } catch (error) {
    return learningErrorResponse(error)
  }
}
