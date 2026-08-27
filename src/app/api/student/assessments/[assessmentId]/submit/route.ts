import { NextRequest, NextResponse } from 'next/server'
import { submitAssessment } from '@/server/services/learning-content-service'
import { getAssessmentScope, learningErrorResponse, requireStudentForScope, submissionSchema } from '@/lib/learning-api'

export async function POST(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await params
    const access = await requireStudentForScope(await getAssessmentScope(assessmentId))
    if ('error' in access) return access.error
    const { answers } = submissionSchema.parse(await request.json())
    const attempt = await submitAssessment(access.userId, assessmentId, answers)
    return NextResponse.json({ success: true, data: attempt }, { status: 201 })
  } catch (error) {
    return learningErrorResponse(error)
  }
}
