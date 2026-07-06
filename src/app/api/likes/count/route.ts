/**
 * GET /api/likes/count
 * Get like counts for courses and modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { CommunityService } from '@/server/services/community-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const courseIdsParam = searchParams.get('courseIds')
    const moduleIdsParam = searchParams.get('moduleIds')

    const courseIds = courseIdsParam ? courseIdsParam.split(',').filter((id) => id.trim()) : undefined
    const moduleIds = moduleIdsParam ? moduleIdsParam.split(',').filter((id) => id.trim()) : undefined

    if (!courseIds && !moduleIds) {
      return NextResponse.json(
        { success: false, error: 'Either courseIds or moduleIds query parameter must be provided' },
        { status: 400 }
      )
    }

    if (moduleIds && moduleIds.length > 0) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.email) {
        return NextResponse.json(
          { success: false, error: 'Debes iniciar sesion para consultar likes de modulos privados' },
          { status: 401 }
        )
      }

      const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, role: true },
      })

      if (!user) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }

      if (user.role !== 'ADMIN') {
        const modules = await db.module.findMany({
          where: { id: { in: moduleIds } },
          select: { id: true, courseId: true },
        })

        if (modules.length !== moduleIds.length) {
          return NextResponse.json({ success: false, error: 'One or more modules were not found' }, { status: 404 })
        }

        const courseIdsForModules = Array.from(new Set(modules.map((module) => module.courseId)))
        const accesses = await db.courseAccess.findMany({
          where: {
            userId: user.id,
            courseId: { in: courseIdsForModules },
            OR: [{ accessUntil: null }, { accessUntil: { gt: new Date() } }],
          },
          select: { courseId: true },
        })

        const activeCourseIds = new Set(accesses.map((item) => item.courseId))
        const hasFullAccess = courseIdsForModules.every((courseId) => activeCourseIds.has(courseId))

        if (!hasFullAccess) {
          return NextResponse.json(
            { success: false, error: 'No tienes acceso a uno o mas modulos solicitados' },
            { status: 403 }
          )
        }
      }
    }

    const counts = await CommunityService.getLikeCounts(courseIds, moduleIds)

    return NextResponse.json({
      success: true,
      data: counts,
    })
  } catch (error) {
    console.error('Error fetching like counts:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch like counts',
      },
      { status: 500 }
    )
  }
}
