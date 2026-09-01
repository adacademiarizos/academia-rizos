import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { CourseDraftValidationError, publishCourseDraft } from '@/lib/course-draft'

const PublishBodySchema = z.object({ payload: z.unknown() })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const { courseId } = await params
    const { payload } = PublishBodySchema.parse(await request.json())
    const course = await publishCourseDraft(courseId, payload)
    if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: { courseId: course.id, updatedAt: course.updatedAt } })
  } catch (error) {
    if (error instanceof CourseDraftValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'El contenido del curso tiene un formato inválido.' }, { status: 400 })
    }
    console.error('Error publishing course draft:', error)
    return NextResponse.json({ success: false, error: 'No se pudo publicar el curso' }, { status: 500 })
  }
}
