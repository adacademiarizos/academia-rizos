import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { lessonAuthoringSelect, moduleAuthoringSelect } from '@/lib/academy-content-selects'
import { buildPublishedCourseDraft } from '@/lib/course-draft'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const { courseId } = await params
    const course = await db.course.findUnique({ where: { id: courseId }, select: {
      title: true, description: true, learningOutcomes: true, certificateSlogan: true,
      trailerUrl: true, thumbnailUrl: true, priceCents: true, rentalDays: true,
      isActive: true, contentStructure: true, updatedAt: true,
      modules: { orderBy: { order: 'asc' }, select: {
        ...moduleAuthoringSelect,
        lessons: { orderBy: { order: 'asc' }, select: lessonAuthoringSelect },
      } },
      styles: { orderBy: { order: 'asc' }, select: {
        id: true, courseId: true, order: true, name: true, slug: true, description: true, isActive: true,
        videoFileUrl: true, bannerImageUrl: true, createdAt: true, updatedAt: true,
        lessons: { orderBy: { order: 'asc' }, select: lessonAuthoringSelect },
      } },
    } })
    if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 })
    const payload = buildPublishedCourseDraft(course as never)
    return NextResponse.json({ success: true, data: { payload, source: 'PUBLISHED', needsStructureMigration: !course.contentStructure } })
  } catch (error) {
    console.error('Error loading course editor:', error)
    return NextResponse.json({ success: false, error: 'No se pudo cargar el editor del curso' }, { status: 500 })
  }
}
