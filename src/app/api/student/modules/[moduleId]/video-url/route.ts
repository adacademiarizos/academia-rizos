/**
 * GET /api/student/modules/[moduleId]/video-url
 * Mints a short-lived signed R2 URL for a legacy module-level video (modules
 * without a lesson/style breakdown) after re-validating course access.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByModuleId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { getSignedDownloadUrl, getStorageKeyFromUrl } from '@/lib/storage'
import { db } from '@/lib/db'

const SIGNED_URL_EXPIRY_SECONDS = 5 * 60

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

    const courseModule = await db.module.findUnique({
      where: { id: moduleId },
      select: { videoFileUrl: true, videoUrl: true },
    })

    if (!courseModule?.videoFileUrl) {
      return NextResponse.json({
        success: true,
        data: { videoUrl: courseModule?.videoUrl ?? null, expiresInSeconds: null },
      })
    }

    const key = getStorageKeyFromUrl(courseModule.videoFileUrl)
    if (!key) {
      return NextResponse.json({
        success: true,
        data: { videoUrl: courseModule.videoFileUrl, expiresInSeconds: null },
      })
    }

    const signedUrl = await getSignedDownloadUrl(key, SIGNED_URL_EXPIRY_SECONDS)

    return NextResponse.json({
      success: true,
      data: { videoUrl: signedUrl, expiresInSeconds: SIGNED_URL_EXPIRY_SECONDS },
    })
  } catch (error) {
    console.error('Error minting module video URL:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get video URL' },
      { status: 500 }
    )
  }
}
