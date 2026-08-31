/**
 * GET /api/student/lessons/[lessonId]/video-url
 * Mints a short-lived signed R2 URL for a lesson's video after re-validating
 * course access, so the permanent public URL is never sent to the client.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  authorizeCourseAccessByModuleId,
  authorizeCourseAccessByStyleId,
  toAccessDeniedResponse,
} from '@/lib/course-access-control'
import { getSignedDownloadUrl, getStorageKeyFromUrl } from '@/lib/storage'
import { db } from '@/lib/db'

const SIGNED_URL_EXPIRY_SECONDS = 5 * 60

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: { moduleId: true, styleId: true, videoFileUrl: true, videoUrl: true },
    })

    if (!lesson) {
      return NextResponse.json(
        { success: false, error: 'La lección solicitada no existe.' },
        { status: 404 }
      )
    }

    const access = lesson.moduleId
      ? await authorizeCourseAccessByModuleId(lesson.moduleId, { allowAdmin: true, requireActiveAccess: true })
      : lesson.styleId
      ? await authorizeCourseAccessByStyleId(lesson.styleId, { allowAdmin: true, requireActiveAccess: true })
      : null

    if (!access) {
      return NextResponse.json(
        { success: false, error: 'La lección solicitada no existe.' },
        { status: 404 }
      )
    }

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    if (!lesson.videoFileUrl) {
      return NextResponse.json({
        success: true,
        data: { videoUrl: lesson.videoUrl ?? null, expiresInSeconds: null },
      })
    }

    const key = getStorageKeyFromUrl(lesson.videoFileUrl)
    if (!key) {
      // Not an R2-managed URL (e.g. an old external link) — pass it through as-is.
      return NextResponse.json({
        success: true,
        data: { videoUrl: lesson.videoFileUrl, expiresInSeconds: null },
      })
    }

    const signedUrl = await getSignedDownloadUrl(key, SIGNED_URL_EXPIRY_SECONDS)

    return NextResponse.json({
      success: true,
      data: { videoUrl: signedUrl, expiresInSeconds: SIGNED_URL_EXPIRY_SECONDS },
    })
  } catch (error) {
    console.error('Error minting lesson video URL:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get video URL' },
      { status: 500 }
    )
  }
}
