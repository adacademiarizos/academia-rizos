import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByModuleId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params
    const access = await authorizeCourseAccessByModuleId(moduleId, {
      allowAdmin: true,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    const styles = await db.moduleStyle.findMany({
      where: { moduleId, isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        moduleId: true,
        order: true,
        name: true,
        slug: true,
        description: true,
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            styleId: true,
            moduleId: true,
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
    console.error('Error fetching module styles:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch styles' },
      { status: 500 }
    )
  }
}
