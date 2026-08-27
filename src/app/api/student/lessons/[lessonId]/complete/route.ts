import { NextRequest, NextResponse } from 'next/server'
import { markLessonCompleted } from '@/server/services/learning-content-service'
import { learningErrorResponse, parseScope, requireStudentForScope } from '@/lib/learning-api'

export async function POST(_: NextRequest, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const { lessonId } = await params
    const access = await requireStudentForScope(parseScope('LESSON', lessonId))
    if ('error' in access) return access.error
    const progress = await markLessonCompleted(access.userId, lessonId)
    return NextResponse.json({ success: true, data: progress })
  } catch (error) {
    return learningErrorResponse(error)
  }
}
