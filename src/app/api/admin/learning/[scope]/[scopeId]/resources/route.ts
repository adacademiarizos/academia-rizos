import { NextRequest, NextResponse } from 'next/server'
import { createLearningResource, listLearningResources } from '@/server/services/learning-content-service'
import { learningErrorResponse, parseScope, requireAdminForScope, resourceSchema } from '@/lib/learning-api'

export async function GET(_: NextRequest, { params }: { params: Promise<{ scope: string; scopeId: string }> }) {
  try {
    const { scope, scopeId } = await params
    const ref = parseScope(scope, scopeId)
    const access = await requireAdminForScope(ref)
    if ('error' in access) return access.error
    return NextResponse.json({ success: true, data: await listLearningResources(ref) })
  } catch (error) {
    return learningErrorResponse(error)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ scope: string; scopeId: string }> }) {
  try {
    const { scope, scopeId } = await params
    const ref = parseScope(scope, scopeId)
    const access = await requireAdminForScope(ref)
    if ('error' in access) return access.error
    const resource = await createLearningResource(ref, resourceSchema.parse(await request.json()))
    return NextResponse.json({ success: true, data: resource }, { status: 201 })
  } catch (error) {
    return learningErrorResponse(error)
  }
}
