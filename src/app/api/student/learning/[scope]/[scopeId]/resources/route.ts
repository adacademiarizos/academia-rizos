import { NextRequest, NextResponse } from 'next/server'
import { listLearningResources } from '@/server/services/learning-content-service'
import { learningErrorResponse, parseScope, requireStudentForScope } from '@/lib/learning-api'

export async function GET(_: NextRequest, { params }: { params: Promise<{ scope: string; scopeId: string }> }) {
  try {
    const { scope, scopeId } = await params
    const ref = parseScope(scope, scopeId)
    const access = await requireStudentForScope(ref)
    if ('error' in access) return access.error
    return NextResponse.json({ success: true, data: await listLearningResources(ref) })
  } catch (error) {
    return learningErrorResponse(error)
  }
}
