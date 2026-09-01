import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { CourseDraftValidationError, discardCourseDraft, saveCourseDraft } from '@/lib/course-draft'

const DraftBodySchema = z.object({ payload: z.unknown() })

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const { courseId } = await params
    const { payload } = DraftBodySchema.parse(await request.json())
    const draft = await saveCourseDraft(courseId, payload)
    if (!draft) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: { updatedAt: draft.updatedAt } })
  } catch (error) {
    if (error instanceof CourseDraftValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'El borrador tiene un formato inválido.' }, { status: 400 })
    }
    console.error('Error saving course draft:', error)
    return NextResponse.json({ success: false, error: 'No se pudo guardar el borrador' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const { courseId } = await params
    await discardCourseDraft(courseId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error discarding course draft:', error)
    return NextResponse.json({ success: false, error: 'No se pudo descartar el borrador' }, { status: 500 })
  }
}
