import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params
    const access = await authorizeCourseAccessByCourseId(courseId, {
      allowAdmin: true,
      requireActiveAccess: true,
    })
    if (!access.ok) return toAccessDeniedResponse(access)

    const styles = await db.moduleStyle.findMany({
      where: { courseId, isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        courseId: true,
        order: true,
        name: true,
        slug: true,
        description: true,
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            styleId: true,
            order: true,
            title: true,
            description: true,
            videoUrl: true,
            videoFileUrl: true,
            transcript: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: styles, videoExpired: false })
  } catch (error) {
    console.error('Error fetching course styles:', error)
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los estilos.' }, { status: 500 })
  }
}
