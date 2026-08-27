import { NextRequest, NextResponse } from 'next/server'
import { deleteAssessment, updateAssessment } from '@/server/services/learning-content-service'
import { assessmentPatchSchema, getAssessmentScope, learningErrorResponse, requireAdminForScope } from '@/lib/learning-api'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await params
    const access = await requireAdminForScope(await getAssessmentScope(assessmentId))
    if ('error' in access) return access.error
    const assessment = await updateAssessment(assessmentId, assessmentPatchSchema.parse(await request.json()))
    return NextResponse.json({ success: true, data: assessment })
  } catch (error) {
    return learningErrorResponse(error)
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await params
    const access = await requireAdminForScope(await getAssessmentScope(assessmentId))
    if ('error' in access) return access.error
    await deleteAssessment(assessmentId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return learningErrorResponse(error)
  }
}
