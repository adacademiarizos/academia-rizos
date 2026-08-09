import { NextRequest, NextResponse } from 'next/server'
import { getStudentAssessment } from '@/server/services/learning-content-service'
import { getAssessmentScope, learningErrorResponse, requireStudentForScope } from '@/lib/learning-api'

export async function GET(_: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await params
    const access = await requireStudentForScope(await getAssessmentScope(assessmentId))
    if ('error' in access) return access.error
    return NextResponse.json({ success: true, data: await getStudentAssessment(assessmentId, access.userId) })
  } catch (error) {
    return learningErrorResponse(error)
  }
}
