import { NextRequest, NextResponse } from 'next/server'
import { listAssessments } from '@/server/services/learning-content-service'
import { learningErrorResponse, parseScope, requireStudentForScope } from '@/lib/learning-api'

export async function GET(_: NextRequest, { params }: { params: Promise<{ scope: string; scopeId: string }> }) {
  try {
    const { scope, scopeId } = await params
    const ref = parseScope(scope, scopeId)
    const access = await requireStudentForScope(ref)
    if ('error' in access) return access.error
    const assessments = await listAssessments(ref, { publishedOnly: true })
    return NextResponse.json({
      success: true,
      data: assessments.map(({ questions, ...assessment }) => ({ ...assessment, questionCount: questions.length })),
    })
  } catch (error) {
    return learningErrorResponse(error)
  }
}
