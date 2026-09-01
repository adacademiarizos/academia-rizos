import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { getCourseLearningProgress } from '@/server/services/learning-content-service'

/**
 * The people with access to a course and how far each one got.
 *
 * There was no way to answer "who is enrolled and where are they stuck" from the
 * panel: courseAccess was only read by the notify route.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const { courseId } = await params
    const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } })
    if (!course) return NextResponse.json({ success: false, error: 'El curso no existe.' }, { status: 404 })

    const access = await db.courseAccess.findMany({
      where: { courseId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        accessUntil: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    const students = await Promise.all(
      access.map(async (entry) => {
        const progress = await getCourseLearningProgress(entry.user.id, courseId)
        const certificate = await db.certificate.findFirst({
          where: { userId: entry.user.id, courseId, valid: true },
          select: { code: true, pdfUrl: true, issuedAt: true },
        })
        return {
          user: entry.user,
          since: entry.createdAt,
          accessUntil: entry.accessUntil,
          completedLessons: progress.completedLessons,
          totalLessons: progress.totalLessons,
          percentage: progress.percentage,
          finalEligible: progress.finalEligible,
          certificate,
        }
      })
    )

    return NextResponse.json({ success: true, data: students })
  } catch (error) {
    console.error('Error listing course students:', error)
    return NextResponse.json({ success: false, error: 'No se pudo cargar la lista de alumnas.' }, { status: 500 })
  }
}
