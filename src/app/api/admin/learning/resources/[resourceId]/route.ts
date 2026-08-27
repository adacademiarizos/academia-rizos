import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deleteLearningResource } from '@/server/services/learning-content-service'
import { learningErrorResponse, parseScope, requireAdminForScope } from '@/lib/learning-api'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ resourceId: string }> }) {
  try {
    const { resourceId } = await params
    const resource = await db.learningResource.findUnique({ where: { id: resourceId }, select: { scope: true, courseId: true, moduleId: true, styleId: true, lessonId: true } })
    if (!resource) return NextResponse.json({ success: false, error: 'El recurso no existe.' }, { status: 404 })
    const scopeId = resource.courseId ?? resource.moduleId ?? resource.styleId ?? resource.lessonId
    const access = await requireAdminForScope(parseScope(resource.scope, scopeId ?? ''))
    if ('error' in access) return access.error
    await deleteLearningResource(resourceId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return learningErrorResponse(error)
  }
}
