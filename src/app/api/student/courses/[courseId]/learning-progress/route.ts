import { NextRequest, NextResponse } from 'next/server'
import { getCourseLearningProgress } from '@/server/services/learning-content-service'
import { learningErrorResponse, parseScope, requireStudentForScope } from '@/lib/learning-api'

export async function GET(_: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params
    const access = await requireStudentForScope(parseScope('COURSE', courseId))
    if ('error' in access) return access.error
    return NextResponse.json({ success: true, data: await getCourseLearningProgress(access.userId, courseId) })
  } catch (error) {
    return learningErrorResponse(error)
  }
}
